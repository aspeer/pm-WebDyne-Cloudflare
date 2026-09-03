package WebDyne::Cloudflare::KV;

use 5.020;
use strict;
use warnings;

use Encode qw(decode FB_CROAK);
use Future::AsyncAwait;
use JSON::PP ();
use MIME::Base64 qw(decode_base64);
use Scalar::Util qw(blessed);
use WebDyne::Cloudflare::KV::Blob;
use WebDyne::Cloudflare::KV::Error;

our $VERSION = '0.001';
our $HOST_CALL;

use constant EXTENSION_NAME => 'webdyne.cloudflare.kv';
use constant PROTOCOL_VERSION => 1;

my $JSON = JSON::PP->new->canonical->allow_nonref;

sub new {
    my ($class, %opt) = @_;
    my $scope = $opt{'scope'};
    die "WebDyne::Cloudflare::KV requires a PAGI scope hash\n"
        unless ref($scope) eq 'HASH';
    my $extension = ref($scope->{'extensions'}) eq 'HASH'
        ? $scope->{'extensions'}{EXTENSION_NAME()}
        : undef;
    die "PAGI scope has no " . EXTENSION_NAME() . " capability\n"
        unless ref($extension) eq 'HASH';
    die "Unsupported KV capability protocol\n"
        unless ($extension->{'version'} // 0) == PROTOCOL_VERSION;
    die "Invalid KV capability token\n"
        unless defined($extension->{'capability'})
            && !ref($extension->{'capability'})
            && length($extension->{'capability'});

    my $binding = $opt{'binding'} // 'KV';
    die "Invalid KV binding name '$binding'\n"
        unless $binding =~ /\A[A-Z_][A-Z0-9_]*\z/;
    my %binding = map { $_ => 1 } grep { defined && !ref } @{$extension->{'bindings'} // []};
    die "KV binding '$binding' is not available to this request\n"
        unless $binding{$binding};

    return bless {
        binding    => $binding,
        capability => $extension->{'capability'},
    }, $class;
}

sub binding { return shift()->{'binding'}; }

sub blob {
    shift if @_ > 1 && (ref($_[0]) || $_[0] eq __PACKAGE__);
    return WebDyne::Cloudflare::KV::Blob->new($_[0]);
}

sub _key {
    my ($key) = @_;
    die "KV key must be a non-empty scalar other than . or ..\n"
        unless defined($key) && !ref($key) && length($key) && $key ne '.' && $key ne '..';
    return $key;
}

sub _known_options {
    my ($operation, $allowed, %opt) = @_;
    my %allowed = map { $_ => 1 } @{$allowed};
    my @unknown = sort grep { !$allowed{$_} } keys %opt;
    die "Unknown KV $operation option: $unknown[0]\n" if @unknown;
    return %opt;
}

sub _encode_text {
    my ($value) = @_;
    die "KV value must be a scalar or KV blob\n" if !defined($value) || ref($value);
    return decode('UTF-8', $value, FB_CROAK)
        if !utf8::is_utf8($value) && $value =~ /[\x80-\xff]/;
    return $value;
}

sub _decode_bytes {
    my ($value) = @_;
    return undef unless defined $value;
    die "KV host returned an invalid byte value\n"
        unless ref($value) eq 'HASH'
            && ($value->{'type'} // '') eq 'bytes'
            && defined($value->{'base64'});
    return decode_base64($value->{'base64'});
}

async sub get {
    my ($self, $key, %opt) = @_;
    %opt = _known_options('get', [qw(type cache_ttl)], %opt);
    my $type = $opt{'type'} // 'text';
    die "KV get type must be text, json, or bytes\n"
        unless $type eq 'text' || $type eq 'json' || $type eq 'bytes';
    my $result = await $self->_execute(
        operation => 'get',
        key       => _key($key),
        type      => $type,
        (defined($opt{'cache_ttl'}) ? (cache_ttl => $opt{'cache_ttl'}) : ()),
    );
    return $type eq 'bytes' ? _decode_bytes($result) : $result;
}

async sub get_with_metadata {
    my ($self, $key, %opt) = @_;
    %opt = _known_options('get_with_metadata', [qw(type cache_ttl)], %opt);
    my $type = $opt{'type'} // 'text';
    die "KV get type must be text, json, or bytes\n"
        unless $type eq 'text' || $type eq 'json' || $type eq 'bytes';
    my $result = await $self->_execute(
        operation => 'get_with_metadata',
        key       => _key($key),
        type      => $type,
        (defined($opt{'cache_ttl'}) ? (cache_ttl => $opt{'cache_ttl'}) : ()),
    );
    $result->{'value'} = _decode_bytes($result->{'value'})
        if $type eq 'bytes' && ref($result) eq 'HASH';
    return $result;
}

async sub put {
    my ($self, $key, $value, %opt) = @_;
    %opt = _known_options('put', [qw(expiration expiration_ttl metadata)], %opt);
    my $encoded = blessed($value) && $value->isa('WebDyne::Cloudflare::KV::Blob')
        ? $value->wire_value()
        : _encode_text($value);
    return await $self->_execute(
        operation => 'put',
        key       => _key($key),
        value     => $encoded,
        (defined($opt{'expiration'}) ? (expiration => $opt{'expiration'}) : ()),
        (defined($opt{'expiration_ttl'}) ? (expiration_ttl => $opt{'expiration_ttl'}) : ()),
        (exists($opt{'metadata'}) ? (metadata => $opt{'metadata'}) : ()),
    );
}

async sub put_json {
    my ($self, $key, $value, %opt) = @_;
    return await $self->put($key, $JSON->encode($value), %opt);
}

async sub delete {
    my ($self, $key) = @_;
    return await $self->_execute(operation => 'delete', key => _key($key));
}

async sub list {
    my ($self, %opt) = @_;
    %opt = _known_options('list', [qw(prefix cursor limit)], %opt);
    return await $self->_execute(operation => 'list', %opt);
}

sub _call_host {
    my ($wire) = @_;
    return $HOST_CALL->($wire) if $HOST_CALL;
    no strict 'refs';
    my $host_call = *{'WebDyne::Cloudflare::KV::Host::call'}{'CODE'};
    die "KV host adapter is not registered in this runtime\n" unless $host_call;
    return $host_call->($wire);
}

async sub _execute {
    my ($self, %request) = @_;
    my $wire = {
        version    => PROTOCOL_VERSION,
        capability => $self->{'capability'},
        binding    => $self->{'binding'},
        %request,
    };
    my $response_wire = _call_host($JSON->encode($wire));
    my $response = eval { $JSON->decode($response_wire) };
    if (!$response || ref($response) ne 'HASH') {
        my $detail = $@ || 'host returned an invalid response';
        die WebDyne::Cloudflare::KV::Error->new(name => 'KV_PROTOCOL_ERROR', message => $detail);
    }
    unless ($response->{'ok'}) {
        my $error = ref($response->{'error'}) eq 'HASH' ? $response->{'error'} : {};
        die WebDyne::Cloudflare::KV::Error->new(%{$error});
    }
    return $response->{'result'};
}

1;

__END__

=head1 NAME

WebDyne::Cloudflare::KV - Future-returning Cloudflare Workers KV facade

=head1 SYNOPSIS

  use WebDyne::Cloudflare::KV;

  my $kv = WebDyne::Cloudflare::KV->new(
      scope   => $self->r()->{'scope'},
      binding => 'CACHE',
  );
  await $kv->put('greeting', 'hello', metadata => { source => 'WebDyne' });
  my $value = await $kv->get('greeting');

=head1 DESCRIPTION

The facade exposes buffered KV get, get-with-metadata, put, delete, and list
operations through a request-scoped capability. Methods return C<Future>
objects. Use C<blob($bytes)> and C<type =E<gt> 'bytes'> for binary values.

=cut
