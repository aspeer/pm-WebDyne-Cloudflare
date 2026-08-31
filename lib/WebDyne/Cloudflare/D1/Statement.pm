package WebDyne::Cloudflare::D1::Statement;

use 5.020;
use strict;
use warnings;
use Future::AsyncAwait;
use JSON::PP ();

our $VERSION = '0.001';

sub new {
    my ($class, %opt) = @_;
    return bless {
        database => $opt{'database'},
        sql      => $opt{'sql'},
        params   => $opt{'params'} // [],
    }, $class;
}

sub bind {
    my ($self, @param) = @_;
    return ref($self)->new(
        database => $self->{'database'},
        sql      => $self->{'sql'},
        params   => \@param,
    );
}

async sub run {
    my ($self) = @_;
    return await $self->{'database'}->_execute(
        operation => 'run',
        sql       => $self->{'sql'},
        params    => $self->{'params'},
    );
}

async sub all {
    my ($self) = @_;
    return await $self->run();
}

async sub first {
    my ($self, $column) = @_;
    my %request = (
        operation => 'first',
        sql       => $self->{'sql'},
        params    => $self->{'params'},
    );
    $request{'column'} = $column if defined $column;
    return await $self->{'database'}->_execute(%request);
}

async sub raw {
    my ($self, %opt) = @_;
    return await $self->{'database'}->_execute(
        operation    => 'raw',
        sql          => $self->{'sql'},
        params       => $self->{'params'},
        column_names => $opt{'column_names'} ? JSON::PP::true : JSON::PP::false,
    );
}

1;
