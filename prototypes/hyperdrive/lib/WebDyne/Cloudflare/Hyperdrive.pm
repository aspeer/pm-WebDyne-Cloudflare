package WebDyne::Cloudflare::Hyperdrive;

use 5.020;
use strict;
use warnings;
use Future::AsyncAwait;
use JSON::PP ();
use MIME::Base64 qw(encode_base64);

my $json_or=JSON::PP->new()->allow_nonref();

sub new {
    my ($class, %opt)=@_;
    my $extension_hr=$opt{'scope'}{'extensions'}{'webdyne.cloudflare.hyperdrive.prototype'};
    die "missing prototype scope\n" unless ref($extension_hr) eq 'HASH';
    return bless({%{$extension_hr}}, $class);
}


sub bytes {
    my ($self, $bytes)=@_;
    return ['bytes', encode_base64($bytes, '')];
}


async sub query {
    my ($self, $sql, @param)=@_;
    my $wire=$json_or->encode({
        version    => 1,
        binding    => 'DB',
        capability => $self->{'capability'},
        operation  => 'query',
        sql        => $sql,
        params     => [map { !defined($_) ? ['null', undef] : ref($_) ? $_ : ['text', "$_"] } @param],
    });
    no strict 'refs';
    my $call_cr=*{'WebDyne::Cloudflare::Hyperdrive::Prototype::call'}{'CODE'};
    die "missing prototype host\n" unless $call_cr;
    my $response_hr=$json_or->decode($call_cr->($wire));
    die "$response_hr->{'error'}{'message'}\n" unless $response_hr->{'ok'};
    my $result_hr=$response_hr->{'result'};
    foreach my $row_ar (@{$result_hr->{'rows'}}) {
        foreach my $column_ix (0..$#{$result_hr->{'columns'}}) {
            next unless ($result_hr->{'columns'}[$column_ix]{'oid'}==17)&&defined($row_ar->[$column_ix]);
            die "unexpected BYTEA encoding\n" unless $row_ar->[$column_ix]=~s/\A\\x//;
            $row_ar->[$column_ix]=pack('H*', $row_ar->[$column_ix]);
        }
    }
    return $result_hr;
}

1;
