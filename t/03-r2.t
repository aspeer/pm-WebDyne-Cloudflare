use 5.020;
use strict;
use warnings;
use utf8;
use Test::More;
use JSON::PP ();
use Scalar::Util qw(blessed);
use WebDyne::Cloudflare::R2;

my $json = JSON::PP->new->canonical->allow_nonref;
my @request;
my $object = {
    key => 'webdyne/example.bin', version => 'one', size => 3,
    etag => 'etag-one', http_etag => '"etag-one"',
    uploaded => '2026-09-03T00:00:00.000Z',
    http_metadata => { content_type => 'application/octet-stream' },
    custom_metadata => { source => 'WebDyne' }, storage_class => 'Standard',
};
local $WebDyne::Cloudflare::R2::HOST_CALL = sub {
    my ($wire) = @_;
    my $request = $json->decode($wire);
    push @request, $request;
    my $result = $request->{'operation'} eq 'get'
        ? {%{$object}, body => { type => 'bytes', base64 => 'AAH/' }}
        : $request->{'operation'} eq 'head' || $request->{'operation'} eq 'put'
            ? {%{$object}}
            : $request->{'operation'} eq 'list'
                ? { objects => [{%{$object}}], truncated => JSON::PP::false }
                : JSON::PP::true;
    return $json->encode({ ok => JSON::PP::true, result => $result });
};

my $scope = {
    extensions => {
        'webdyne.cloudflare.r2' => {
            version => 1, capability => 'r2-capability', bindings => ['ASSETS'],
        },
    },
};
my $r2 = WebDyne::Cloudflare::R2->new(scope => $scope, binding => 'ASSETS');
is($r2->binding(), 'ASSETS', 'R2 binding retained');
my $received = $r2->get('webdyne/example.bin', range => { offset => 1, length => 2 })->get();
isa_ok($received, 'WebDyne::Cloudflare::R2::Object');
is($received->body(), "\0\1\xff", 'R2 body decoded');
is($received->http_etag(), '"etag-one"', 'R2 HTTP etag retained');
is_deeply($request[-1]{'range'}, { offset => 1, length => 2 }, 'R2 range preserved');
is($r2->head('webdyne/example.bin')->get()->size(), 3, 'R2 head returns metadata');

my $stored = $r2->put('webdyne/example.bin', WebDyne::Cloudflare::R2->blob("\0\1\xff"),
    http_metadata => { content_type => 'application/octet-stream' },
    custom_metadata => { source => 'WebDyne' })->get();
isa_ok($stored, 'WebDyne::Cloudflare::R2::Object');
is_deeply($request[-1]{'value'}, { type => 'bytes', base64 => 'AAH/' }, 'R2 blob encoded');
is($request[-1]{'http_metadata'}{'content_type'}, 'application/octet-stream', 'R2 metadata preserved');
my $listed = $r2->list(prefix => 'webdyne/', include => ['customMetadata'])->get();
isa_ok($listed->{'objects'}[0], 'WebDyne::Cloudflare::R2::Object');
is($listed->{'objects'}[0]->custom_metadata()->{'source'}, 'WebDyne', 'R2 list metadata retained');
ok($r2->delete('webdyne/example.bin')->get(), 'single R2 delete succeeds');
ok($r2->delete_many('one', 'two')->get(), 'multiple R2 delete succeeds');
is_deeply($request[-1]{'keys'}, ['one', 'two'], 'multiple keys preserved');

{
    local $WebDyne::Cloudflare::R2::HOST_CALL = sub {
        return $json->encode({ ok => JSON::PP::false,
            error => { name => 'R2_ERROR', message => 'R2 unavailable' } });
    };
    my $future = $r2->get('webdyne/example.bin');
    ok($future->is_failed(), 'R2 host error fails the Future');
    my ($error) = $future->failure();
    ok(blessed($error) && $error->isa('WebDyne::Cloudflare::R2::Error'), 'R2 failure is structured');
    like("$error", qr/R2_ERROR: R2 unavailable/, 'R2 error text is useful');
}

eval { WebDyne::Cloudflare::R2->new(scope => { extensions => {} }) };
like($@, qr/has no webdyne\.cloudflare\.r2 capability/, 'missing R2 capability rejected');
eval { $r2->put('bad', {})->get() };
like($@, qr/object must be a scalar or R2 blob/, 'structured R2 body rejected');

done_testing;
