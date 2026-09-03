#!/usr/bin/env perl

use 5.020;
use strict;
use warnings;
use File::Copy qw(copy);
use File::Path qw(make_path);
use File::Spec;

my $worker = shift @ARGV or die "Usage: $0 WORKER_DIRECTORY\n";
die "Unexpected arguments\n" if @ARGV;
$worker = File::Spec->rel2abs($worker);
die "Worker directory does not contain package.json: $worker\n"
    unless -f File::Spec->catfile($worker, 'package.json');

my @module = qw(
    WebDyne/Cloudflare.pm
    WebDyne/Cloudflare/D1.pm
    WebDyne/Cloudflare/D1/Blob.pm
    WebDyne/Cloudflare/D1/Error.pm
    WebDyne/Cloudflare/D1/Statement.pm
    WebDyne/Cloudflare/KV.pm
    WebDyne/Cloudflare/KV/Blob.pm
    WebDyne/Cloudflare/KV/Error.pm
    WebDyne/Cloudflare/R2.pm
    WebDyne/Cloudflare/R2/Blob.pm
    WebDyne/Cloudflare/R2/Error.pm
    WebDyne/Cloudflare/R2/Object.pm
);
for my $relative (@module) {
    my $source = File::Spec->catfile('lib', split m{/}, $relative);
    my $target = File::Spec->catfile($worker, 'local', 'lib', 'perl5', split m{/}, $relative);
    my (undef, $directory) = File::Spec->splitpath($target);
    make_path($directory);
    copy($source, $target) or die "Unable to copy $source to $target: $!\n";
    print "Staged $relative\n";
}

for my $page (qw(d1.psp d1-api.psp kv.psp r2.psp)) {
    my $page_source = File::Spec->catfile('examples', 'htdocs', $page);
    my $page_target = File::Spec->catfile($worker, 'htdocs', $page);
    copy($page_source, $page_target)
        or die "Unable to copy $page_source to $page_target: $!\n";
    print "Staged $page\n";
}
