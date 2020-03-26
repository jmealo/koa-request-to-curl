var os = require('os');

function escapeStringWindows (str) {
    return "\"" + str.replace(/"/g, "\"\"")
            .replace(/%/g, "\"%\"")
            .replace(/\\/g, "\\\\")
            .replace(/[\r\n]+/g, "\"^$&\"") + "\"";
}

function escapeStringPosix(str) {
    function escapeCharacter(x) {
        var code = x.charCodeAt(0);
        if (code < 256) {
            // Add leading zero when needed to not care about the next character.
            return code < 16 ? "\\x0" + code.toString(16) : "\\x" + code.toString(16);
        }
        code = code.toString(16);
        return "\\u" + ("0000" + code).substr(code.length, 4);
    }

    if (/[^\x20-\x7E]|\'/.test(str)) {
        // Use ANSI-C quoting syntax.
        return "$\'" + str.replace(/\\/g, "\\\\")
                .replace(/\'/g, "\\\'")
                .replace(/\n/g, "\\n")
                .replace(/\r/g, "\\r")
                .replace(/[^\x20-\x7E]/g, escapeCharacter) + "'";
    } else {
        // Use single quote syntax.
        return "'" + str + "'";
    }
}

function toCurl(platform) {
    platform = platform || (os.platform().startsWith('win') ? 'win' : 'posix');

    var command = ['curl'],
        ignoredHeaders = ['host', 'method', 'path', 'scheme', 'version'],
        escapeString = platform === 'win' ? escapeStringWindows : escapeStringPosix,
        data = [],
        requestHeaders = this.request.headers,
        requestBody = typeof this.request.body === 'object' ? JSON.stringify(this.request.body) : this.request.body,
        contentType = requestHeaders['content-type'],
        url = (this.secure ? 'https://' : 'http://') + this.host + this.url;

    command.push(escapeString(url).replace(/[[{}\]]/g, "\\$&"));

    if (requestBody) {
        ignoredHeaders.push('content-length');
        if (contentType && contentType.startsWith('application/x-www-form-urlencoded')) {
            data.push('--data');
        } else if (requestBody) {
            data.push('--data-binary');
        }

        data.push(escapeString(requestBody));
    }

    command.push('-X');
    command.push(this.method);

    Object.keys(requestHeaders)
        .filter(name => ignoredHeaders.indexOf(name) === -1)
        .forEach(function(name) {
        command.push('-H');
        command.push(escapeString(name.replace(/^:/, '') + ': ' + requestHeaders[name]));
    });

    command = command.concat(data);
    command.push('--compressed');

    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED == "0") {
        command.push('--insecure');
    }

    return command.join(' ');
}


module.exports = function(options) {
    return async function koaRequestToCurl(ctx, next) {
        ctx.toCurl = toCurl;
        await next();
    };
};
