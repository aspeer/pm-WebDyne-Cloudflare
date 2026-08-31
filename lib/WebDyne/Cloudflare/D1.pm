package WebDyne::Cloudflare::D1;

use 5.020;
use strict;
use warnings;

use Future::AsyncAwait;
use Encode qw(decode FB_CROAK);
use JSON::PP ();
use MIME::Base64 qw(decode_base64);
use Scalar::Util qw(blessed);
use WebDyne::Cloudflare::D1::Blob;
use WebDyne::Cloudflare::D1::Error;
use WebDyne::Cloudflare::D1::Statement;

our $VERSION = '0.001';
our $HOST_CALL;

use constant EXTENSION_NAME => 'webdyne.cloudflare.d1';
use constant PROTOCOL_VERSION => 1;

my $JSON = JSON::PP->new->canonical->allow_nonref;

sub new {
    my ($class, %opt) = @_;
    my $scope = $opt{'scope'};
    die "WebDyne::Cloudflare::D1 requires a PAGI scope hash\n"
        unless ref($scope) eq 'HASH';
    my $extension = $scope->{'extensions'}{EXTENSION_NAME()};
    die "PAGI scope has no " . EXTENSION_NAME() . " capability\n"
        unless ref($extension) eq 'HASH';
    die "Unsupported D1 capability protocol\n"
        unless ($extension->{'version'} // 0) == PROTOCOL_VERSION;
    die "Invalid D1 capability token\n"
        unless defined($extension->{'capability'})
            && !ref($extension->{'capability'})
            && length($extension->{'capability'});

    my $binding = $opt{'binding'} // 'DB';
    die "Invalid D1 binding name '$binding'\n"
        unless $binding =~ /\A[A-Z_][A-Z0-9_]*\z/;
    my %binding = map { $_ => 1 } grep { defined && !ref } @{$extension->{'bindings'} // []};
    die "D1 binding '$binding' is not available to this request\n"
        unless $binding{$binding};

    return bless {
        binding    => $binding,
        capability => $extension->{'capability'},
    }, $class;
}

sub binding {
    return shift()->{'binding'};
}

sub blob {
    shift if @_ > 1 && (ref($_[0]) || $_[0] eq __PACKAGE__);
    return WebDyne::Cloudflare::D1::Blob->new($_[0]);
}

sub prepare {
    my ($self, $sql) = @_;
    die "D1 prepare requires a non-empty SQL string\n"
        unless defined($sql) && !ref($sql) && length($sql);
    return WebDyne::Cloudflare::D1::Statement->new(
        database => $self,
        sql      => $sql,
    );
}

async sub run {
    my ($self, $sql, @param) = @_;
    return await $self->prepare($sql)->bind(@param)->run();
}

async sub all {
    my ($self, $sql, @param) = @_;
    return await $self->prepare($sql)->bind(@param)->all();
}

async sub first {
    my ($self, $sql, @param) = @_;
    return await $self->prepare($sql)->bind(@param)->first();
}

sub _encode_parameter {
    my ($value) = @_;
    return undef unless defined $value;
    if (blessed($value) && $value->isa('WebDyne::Cloudflare::D1::Blob')) {
        return $value->wire_value();
    }
    if (!ref($value)) {
        # D1 strings are JavaScript Unicode strings. Web/CGI values commonly
        # arrive as unflagged UTF-8 bytes, while ASCII numeric/string flags are
        # already preserved correctly by JSON::PP. Binary input must use blob().
        return decode('UTF-8', $value, FB_CROAK)
            if !utf8::is_utf8($value) && $value =~ /[\x80-\xff]/;
        return $value;
    }
    return $value if blessed($value) && $value->isa('JSON::PP::Boolean');
    die "D1 bind values must be scalars, undef, JSON booleans, or D1 blobs\n";
}

sub _decode_value {
    my ($value) = @_;
    if (ref($value) eq 'HASH'
        && ($value->{'type'} // '') eq 'blob'
        && defined($value->{'base64'})) {
        return decode_base64($value->{'base64'});
    }
    if (ref($value) eq 'ARRAY') {
        return [map { _decode_value($_) } @{$value}];
    }
    if (ref($value) eq 'HASH') {
        return {map { $_ => _decode_value($value->{$_}) } keys %{$value}};
    }
    return $value;
}

sub _call_host {
    my ($wire) = @_;
    return $HOST_CALL->($wire) if $HOST_CALL;
    no strict 'refs';
    my $host_call = *{'WebDyne::Cloudflare::D1::Host::call'}{'CODE'};
    die "D1 host adapter is not registered in this runtime\n" unless $host_call;
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
    $wire->{'params'} = [map { _encode_parameter($_) } @{$wire->{'params'} // []}];

    my $response_wire = _call_host($JSON->encode($wire));
    my $response = eval { $JSON->decode($response_wire) };
    if (!$response || ref($response) ne 'HASH') {
        my $detail = $@ || 'host returned an invalid response';
        die WebDyne::Cloudflare::D1::Error->new(
            name    => 'D1_PROTOCOL_ERROR',
            message => $detail,
        );
    }
    unless ($response->{'ok'}) {
        my $error = ref($response->{'error'}) eq 'HASH' ? $response->{'error'} : {};
        die WebDyne::Cloudflare::D1::Error->new(%{$error});
    }
    return _decode_value($response->{'result'});
}

1;

__END__

=head1 NAME

WebDyne::Cloudflare::D1 - Future-returning Cloudflare D1 facade

=head1 SYNOPSIS

  use Future::AsyncAwait;
  use WebDyne::Cloudflare::D1;

  my $db = WebDyne::Cloudflare::D1->new(
      scope   => $self->r()->{'scope'},
      binding => 'DB',
  );

  my $result = await $db->prepare(
      'INSERT INTO things(name) VALUES (?1)'
  )->bind($name)->run();

  my $row = await $db->prepare(
      'SELECT id, name FROM things WHERE name = ?1 LIMIT 1'
  )->bind($name)->first();

=head1 DESCRIPTION

The facade consumes an opaque D1 capability from the PAGI scope. It never
contains or serializes a Cloudflare binding object. Statement execution returns
a C<Future>; host errors fail that Future with a
C<WebDyne::Cloudflare::D1::Error>.

Use C<?1>, C<?2>, and other ordered placeholders for dynamic values. Wrap byte
strings with C<WebDyne::Cloudflare::D1-E<gt>blob($bytes)> to bind a D1 BLOB.

=cut
