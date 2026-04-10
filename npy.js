function npyjs() {
    this.load = function(url) {
        return fetch(url).then(response => response.arrayBuffer()).then(buffer => {
            return this.parse(buffer);
        });
    };
    this.parse = function(buffer) {
        const headerLength = new Uint16Array(buffer.slice(8, 10))[0];
        const headerBuffer = buffer.slice(10, 10 + headerLength);
        const headerStr = String.fromCharCode.apply(null, new Uint8Array(headerBuffer));
        const shapeMatch = headerStr.match(/'shape':\s*\(([^)]+)\)/);
        const shape = shapeMatch[1].split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s));
        const descrMatch = headerStr.match(/'descr':\s*'([^']+)'/);
        const descr = descrMatch[1];
        const dataBuffer = buffer.slice(10 + headerLength);
        let data;
        if (descr.includes('f4')) data = new Float32Array(dataBuffer);
        else if (descr.includes('i4')) data = new Int32Array(dataBuffer);
        else data = new Uint8Array(dataBuffer);
        return { shape: shape, data: data, descr: descr };
    };
}