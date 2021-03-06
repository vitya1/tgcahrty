const fs = require('fs');
const http = require('http');

http.createServer((request, response) => {

    request.on('error', err =>  console.error(err))
    .on('data', () => {})
    .on('end', () => {
        if(request.url == '/') {
            response.write(fs.readFileSync('index.html', 'utf8'));
        }
        else if(request.url == '/lib/index.js') {
            response.write(fs.readFileSync('lib/index.js', 'utf8'));
        }
        else if(request.url == '/dist/bundle.js') {
            response.write(fs.readFileSync('dist/bundle.js', 'utf8'));
        }
        else if(request.url == '/css/styles.css') {
            response.write(fs.readFileSync('css/styles.css', 'utf8'));
        }
        else if(request.url == '/zoom-out.png') {
            response.write(fs.readFileSync('zoom-out.png'));
        }
        else if(/\.json$/.test(request.url)) {
            const file = __dirname + request.url;
            const json = fs.readFileSync(file, 'utf8');
            response.statusCode = 200;
            response.setHeader('Content-Type', 'application/json');
            response.write(json);
            response.end();
        }
        response.statusCode = 200;
        response.end();

    });
}).listen(8081);
