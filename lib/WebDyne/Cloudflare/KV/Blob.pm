package WebDyne::Cloudflare::KV::Blob;

use 5.020;
use strict;
use warnings;
use MIME::Base64 qw(encode_base64);

our $VERSION = '0.001';

sub new {
    my ($class, $bytes) = @_;
    die "KV blob requires a defined byte string\n" if !defined($bytes) || ref($bytes);
    return bless \$bytes, $class;
}

sub wire_value {
    my ($self) = @_;
    return { type => 'bytes', base64 => encode_base64(${$self}, '') };
}

1;
