package WebDyne::Cloudflare::R2;

use 5.020;
use strict;
use warnings;

use Encode qw(decode FB_CROAK);
use Future::AsyncAwait;
use JSON::PP ();
use MIME::Base64 qw(decode_base64);
use Scalar::Util qw(blessed);
use WebDyne::Cloudflare::R2::Blob;
use WebDyne::Cloudflare::R2::Error;
use WebDyne::Cloudflare::R2::Object;

our $VERSION = '0.001';
our $HOST_CALL;

use constant EXTENSION_NAME => 'webdyne.cloudflare.r2';
use constant PROTOCOL_VERSION => 1;

my $JSON = JSON::PP->new->canonical->allow_nonref;

sub new {
    my ($class, %opt) = @_;
    my $scope = $opt{'scope'};
    die "WebDyne::Cloudflare::R2 requires a PAGI scope hash\n"
        unless ref($scope) eq 'HASH';
    my $extension = ref($scope->{'extensions'}) eq 'HASH'
        ? $scope->{'extensions'}{EXTENSION_NAME()}
        : undef;
    die "PAGI scope has no " . EXTENSION_NAME() . " capability\n"
        unless ref($extension) eq 'HASH';
    die "Unsupported R2 capability protocol\n"
        unless ($extension->{'version'} // 0) == PROTOCOL_VERSION;
    die "Invalid R2 capability token\n"
        unless defined($extension->{'capability'})
            && !ref($extension->{'capability'})
            && length($extension->{'capability'});

    my $binding = $opt{'binding'} // 'R2';
    die "Invalid R2 binding name '$binding'\n"
        unless $binding =~ /\A[A-Z_][A-Z0-9_]*\z/;
    my %binding = map { $_ => 1 } grep { defined && !ref } @{$extension->{'bindings'} // []};
    die "R2 binding '$binding' is not available to this request\n"
        unless $binding{$binding};

    return bless {
        binding    => $binding,
        capability => $extension->{'capability'},
    }, $class;
}

sub binding { return shift()->{'binding'}; }

sub blob {
    shift if @_ > 1 && (ref($_[0]) || $_[0] eq __PACKAGE__);
    return WebDyne::Cloudflare::R2::Blob->new($_[0]);
}

sub _key {
    my ($key) = @_;
    die "R2 key must be a non-empty scalar\n"
        unless defined($key) && !ref($key) && length($key);
    return $key;
}

sub _known_options {
    my ($operation, $allowed, %opt) = @_;
    my %allowed = map { $_ => 1 } @{$allowed};
    my @unknown = sort grep { !$allowed{$_} } keys %opt;
    die "Unknown R2 $operation option: $unknown[0]\n" if @unknown;
    return %opt;
}

sub _encode_text {
    my ($value) = @_;
    die "R2 object must be a scalar or R2 blob\n" if !defined($value) || ref($value);
    return decode('UTF-8', $value, FB_CROAK)
        if !utf8::is_utf8($value) && $value =~ /[\x80-\xff]/;
    return $value;
}

sub _object {
    my ($value) = @_;
    return undef unless defined $value;
    die "R2 host returned invalid object metadata\n" unless ref($value) eq 'HASH';
    if (exists($value->{'body'})) {
        my $body = $value->{'body'};
        die "R2 host returned an invalid object body\n"
            unless ref($body) eq 'HASH'
                && ($body->{'type'} // '') eq 'bytes'
                && defined($body->{'base64'});
        $value->{'body'} = decode_base64($body->{'base64'});
    }
    return WebDyne::Cloudflare::R2::Object->new($value);
}

async sub get {
    my ($self, $key, %opt) = @_;
    %opt = _known_options('get', [qw(range)], %opt);
    return _object(await $self->_execute(
        operation => 'get',
        key       => _key($key),
        (exists($opt{'range'}) ? (range => $opt{'range'}) : ()),
    ));
}

async sub head {
    my ($self, $key) = @_;
    return _object(await $self->_execute(operation => 'head', key => _key($key)));
}

async sub put {
    my ($self, $key, $value, %opt) = @_;
    %opt = _known_options('put', [qw(http_metadata custom_metadata storage_class)], %opt);
    my $encoded = blessed($value) && $value->isa('WebDyne::Cloudflare::R2::Blob')
        ? $value->wire_value()
        : _encode_text($value);
    return _object(await $self->_execute(
        operation => 'put',
        key       => _key($key),
        value     => $encoded,
        %opt,
    ));
}

async sub delete {
    my ($self, $key) = @_;
    return await $self->_execute(operation => 'delete', key => _key($key));
}

async sub delete_many {
    my ($self, @keys) = @_;
    die "R2 delete_many requires at least one key\n" unless @keys;
    die "R2 delete_many accepts at most 1000 keys\n" if @keys > 1000;
    return await $self->_execute(operation => 'delete', keys => [map { _key($_) } @keys]);
}

async sub list {
    my ($self, %opt) = @_;
    %opt = _known_options('list', [qw(prefix cursor delimiter limit include)], %opt);
    my $result = await $self->_execute(operation => 'list', %opt);
    die "R2 host returned an invalid list response\n" unless ref($result) eq 'HASH';
    $result->{'objects'} = [map { _object($_) } @{$result->{'objects'} // []}];
    return $result;
}

sub _call_host {
    my ($wire) = @_;
    return $HOST_CALL->($wire) if $HOST_CALL;
    no strict 'refs';
    my $host_call = *{'WebDyne::Cloudflare::R2::Host::call'}{'CODE'};
    die "R2 host adapter is not registered in this runtime\n" unless $host_call;
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
        die WebDyne::Cloudflare::R2::Error->new(name => 'R2_PROTOCOL_ERROR', message => $detail);
    }
    unless ($response->{'ok'}) {
        my $error = ref($response->{'error'}) eq 'HASH' ? $response->{'error'} : {};
        die WebDyne::Cloudflare::R2::Error->new(%{$error});
    }
    return $response->{'result'};
}

1;

__END__

=head1 NAME

WebDyne::Cloudflare::R2 - Future-returning Cloudflare R2 facade

=head1 SYNOPSIS

  use WebDyne::Cloudflare::R2;

  my $bucket = WebDyne::Cloudflare::R2->new(
      scope   => $self->r()->{'scope'},
      binding => 'ASSETS',
  );
  await $bucket->put('hello.txt', 'hello',
      http_metadata => { content_type => 'text/plain' });
  my $object = await $bucket->get('hello.txt');

=head1 DESCRIPTION

The facade exposes buffered R2 get, head, put, delete, and list operations
through a request-scoped capability. Methods return C<Future> objects. Use
C<blob($bytes)> for binary bodies. Reads are limited by the JavaScript adapter's
configured maximum and intentionally do not expose streaming or multipart APIs.

=cut
