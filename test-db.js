const mysql = require('mysql2/promise');

async function test() {
    const host = 'trolley.proxy.rlwy.net';
    const port = 41564;
    const user = 'root';
    const password = 'SQqsnxRJQzWsVzbWSBiqchSPFaxaMfsJ';

    console.log('Testing connection with HARDCODED credentials:');
    console.log('Host:', host);
    console.log('Port:', port);
    console.log('User:', user);

    try {
        const connection = await mysql.createConnection({
            host,
            port,
            user,
            password
        });
        console.log('✅ Success! Connection established.');
        await connection.end();
    } catch (err) {
        console.error('❌ Failed!');
        console.log('Full Error Object:', JSON.stringify(err, null, 2));
    }
}

test();
