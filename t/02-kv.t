use 5.020;
use strict;
use warnings;
use utf8;
use Test::More;
use JSON::PP ();
use Scalar::Util qw(blessed);
use WebDyne::Cloudflare::KV;

my $json = JSON::PP->new->canonical->allow_nonref;
my @request;
local $WebDyne::Cloudflare::KV::HOST_CALL = sub {
    my ($wire) = @_;
    my $request = $json->decode($wire);
    push @request, $request;
    my $result = $request->{'operation'} eq 'get'
        ? ($request->{'type'} eq 'bytes' ? { type => 'bytes', base64 => 'AAH/' }
            : $request->{'type'} eq 'json' ? { answer => 42 } : 'WebDyne')
        : $request->{'operation'} eq 'get_with_metadata'
            ? { value => 'WebDyne', metadata => { source => 'test' } }
            : $request->{'operation'} eq 'list'
                ? { keys => [{ name => 'webdyne:key' }], list_complete => JSON::PP::true }
                : JSON::PP::true;
    return $json->encode({ ok => JSON::PP::true, result => $result });
};

my $scope = {
    extensions => {
        'webdyne.cloudflare.kv' => {
            version => 1, capability => 'kv-capability', bindings => ['CACHE'],
        },
    },
};
my $kv = WebDyne::Cloudflare::KV->new(scope => $scope, binding => 'CACHE');
is($kv->binding(), 'CACHE', 'KV binding retained');
is($kv->get('greeting')->get(), 'WebDyne', 'text value returned');
is($kv->get('binary', type => 'bytes')->get(), "\0\1\xff", 'byte value decoded');
is_deeply($kv->get('json', type => 'json')->get(), { answer => 42 }, 'JSON value returned');
is_deeply($kv->get_with_metadata('greeting')->get(), {
    value => 'WebDyne', metadata => { source => 'test' },
}, 'value and metadata returned');

ok($kv->put('binary', WebDyne::Cloudflare::KV->blob("\0\1\xff"),
    expiration_ttl => 60, metadata => { source => 'test' })->get(), 'blob put succeeds');
is_deeply($request[-1]{'value'}, { type => 'bytes', base64 => 'AAH/' }, 'blob put encoded');
is($request[-1]{'expiration_ttl'}, 60, 'expiration TTL preserved');
$kv->put('unicode', "\xcf\x80")->get();
is($request[-1]{'value'}, 'π', 'unflagged UTF-8 text becomes Unicode');
$kv->put_json('json', { answer => 42 })->get();
is_deeply($json->decode($request[-1]{'value'}), { answer => 42 }, 'put_json encodes structured data');
is_deeply($kv->list(prefix => 'webdyne:', limit => 10)->get()->{'keys'},
    [{ name => 'webdyne:key' }], 'list options return keys');
ok($kv->delete('greeting')->get(), 'delete succeeds');

{
    local $WebDyne::Cloudflare::KV::HOST_CALL = sub {
        return $json->encode({ ok => JSON::PP::false,
            error => { name => 'KV_ERROR', code => 10000, message => 'KV unavailable' } });
    };
    my $future = $kv->get('greeting');
    ok($future->is_failed(), 'KV host error fails the Future');
    my ($error) = $future->failure();
    ok(blessed($error) && $error->isa('WebDyne::Cloudflare::KV::Error'), 'KV failure is structured');
    like("$error", qr/KV_ERROR \[10000\]: KV unavailable/, 'KV error text is useful');
}

eval { WebDyne::Cloudflare::KV->new(scope => { extensions => {} }) };
like($@, qr/has no webdyne\.cloudflare\.kv capability/, 'missing KV capability rejected');
eval { $kv->put('bad', [1, 2])->get() };
like($@, qr/value must be a scalar or KV blob/, 'structured KV value rejected');
eval { $kv->list(unknown => 1)->get() };
like($@, qr/Unknown KV list option/, 'unknown KV option rejected');

done_testing;
