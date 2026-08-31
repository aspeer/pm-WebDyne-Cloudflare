package WebDyne::Cloudflare;

use 5.020;
use strict;
use warnings;

our $VERSION = '0.001';

1;

__END__

=head1 NAME

WebDyne::Cloudflare - Cloudflare service capabilities for WebDyne::PAGI

=head1 SYNOPSIS

  use WebDyne::Cloudflare::D1;

=head1 DESCRIPTION

This distribution provides Perl facades and JavaScript host adapters for
Cloudflare services used by WebDyne::PAGI applications. Cloudflare binding
objects remain in the Worker host and cross into Perl only through opaque,
request-scoped capabilities.

=cut
