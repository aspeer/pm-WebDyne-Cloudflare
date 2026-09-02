use 5.020;
use strict;
use warnings;
use ExtUtils::MakeMaker;

WriteMakefile(
    NAME             => 'WebDyne::Cloudflare',
    VERSION_FROM     => 'lib/WebDyne/Cloudflare.pm',
    ABSTRACT_FROM    => 'lib/WebDyne/Cloudflare.pm',
    AUTHOR           => 'Andrew Speer <andrew.speer@isolutions.com.au>',
    LICENSE          => 'perl_5',
    MIN_PERL_VERSION => '5.020',
    PREREQ_PM        => {
        'Encode'             => 0,
        'Future'             => 0,
        'Future::AsyncAwait' => 0,
        'JSON::PP'           => 0,
        'MIME::Base64'       => 0,
        'Scalar::Util'       => 0,
    },
    TEST_REQUIRES => {
        'Test::More' => 0.88,
    },
    PM => {
        'lib/WebDyne/Cloudflare.pm'              => '$(INST_LIB)/WebDyne/Cloudflare.pm',
        'lib/WebDyne/Cloudflare/D1.pm'           => '$(INST_LIB)/WebDyne/Cloudflare/D1.pm',
        'lib/WebDyne/Cloudflare/D1/Blob.pm'      => '$(INST_LIB)/WebDyne/Cloudflare/D1/Blob.pm',
        'lib/WebDyne/Cloudflare/D1/Error.pm'     => '$(INST_LIB)/WebDyne/Cloudflare/D1/Error.pm',
        'lib/WebDyne/Cloudflare/D1/Statement.pm' => '$(INST_LIB)/WebDyne/Cloudflare/D1/Statement.pm',
    },
    META_MERGE => {
        'meta-spec' => { version => 2 },
        x_authority => 'cpan:ASPEER',
    },
);

sub MY::postamble {
    return <<'MAKE_FRAG';

WORKER_DIR ?= ../wasm-WebDyne-PAGI

.PHONY: test_js d1_local_init d1_local_query d1_smoke worker_stage

test_js:
	$(NOECHO) npm test

test :: test_js

d1_local_init:
	$(NOECHO) npm install
	$(NOECHO) npx wrangler d1 execute DB --local --config examples/wrangler.jsonc --file examples/schema.sql

d1_local_query:
	$(NOECHO) npx wrangler d1 execute DB --local --config examples/wrangler.jsonc --command "SELECT id, name, note FROM webdyne_d1_example ORDER BY id"

d1_smoke:
	$(NOECHO) npm run smoke:d1 -- $(ARGS)

worker_stage:
	$(NOECHO) $(PERL) tools/stage-worker.pl "$(WORKER_DIR)"
	$(NOECHO) cd "$(WORKER_DIR)" && npm run build:perl-lib-vfs
	$(NOECHO) cd "$(WORKER_DIR)" && npm run build:perl-vfs

MAKE_FRAG
}
