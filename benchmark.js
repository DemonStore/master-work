class Benchmark {
    constructor() {
        this.results = {};
        this.tests = [];
        this.nanobar = new Nanobar();
    }

    addTest(group, type, prepare, callback, after) {
        const test = { group, type, prepare, callback, after };
        for (let i = 0; i < 20; i++) {
            this.tests.push(test);
        }
    }

    run() {
        const h1 = document.createElement('h1');
        h1.innerText = 'Executing tests...';
        document.body.appendChild(h1);
        this.total = this.tests.length;
        console.time('tests');
        this.cycle();
    }

    cycle() {
        if (this.tests.length) {
            const ind = Math.floor(Math.random() * this.tests.length);
            const test = this.tests.splice(ind, 1)[0];
            this.nanobar.go(100 - Math.floor(this.tests.length / this.total * 100));
            for (let i = 0; i < 4; i++) {
                test.prepare();
                const start = +new Date();
                test.callback();
                const end = +new Date();
                if (test.after) test.after();
                if (i > 0) {
                    if (!this.results[test.type]) this.results[test.type] = {};
                    if (!this.results[test.type][test.group]) this.results[test.type][test.group] = [];

                    this.results[test.type][test.group].push(end - start);
                }
            }

            setTimeout(this.cycle.bind(this), 1);
        } else {
            this.finish();
        }
    }

    finish() {
        console.timeEnd('tests');

        const data = [];
        for (let i in this.results) {
            const t = this.results[i];
            const trace = {
                x: [],
                y: [],
                name: i,
                type: 'bar',
                error_y: {
                    type: 'data',
                    array: [],
                    visible: true
                }
            };

            for (let j in t) {
                const d = t[j];
                const magn = d.reduce((acc, x) => acc + x, 0)/d.length;
                const sigma = Math.sqrt(d.reduce((acc, x) => acc + (x - magn) * (x - magn))/d.length);

                trace.x.push(j);
                trace.y.push(magn);
                trace.error_y.array.push(sigma);
            }

            data.push(trace);
        }
        this.data = data;
        const layout = {barmode: 'group'};
        const div = document.createElement('div');
        document.body.appendChild(div);
        Plotly.newPlot(div, data, layout);
    }
}

const benc = new Benchmark();

let a, b, c, d, fakeRes;
const size = 2097152; // является степенью двойки и делится на 4 без остатка для удобства

benc.addTest('multiplication', 'typed array', () => {
    a = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        a[i] = i * 0.3333;
    }
    b = new Float32Array(size);
}, () => {
    const length = a.length;
    for (let i = 0; i < length; i++) {
        b[i] = a[i] * 34.1;
    }
});
benc.addTest('multiplication', 'SIMD', () => {
    a = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        a[i] = i * 0.3333;
    }
    b = new Float32Array(size);
    c = SIMD.Float32x4(34.1, 34.1, 34.1, 34.1);
}, () => {
    const length = a.length;
    for (let i = 0; i < length; i += 4) { // прыгаем по 4
        SIMD.Float32x4.store(b, i,
            SIMD.Float32x4.mul(
                SIMD.Float32x4.load(a, i),
                c
            ));
    }
});

benc.addTest('sum', 'typed array', () => {
    a = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        a[i] = i * 0.3333;
    }
    b = 0;
}, () => {
    const length = a.length;
    for (let i = 0; i < length; i++) {
        b += a[i];
    }
});
benc.addTest('sum', 'SIMD', () => {
    a = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        a[i] = i * 0.3333;
    }
    b = 0;
}, () => {
    const length = a.length;
    let i = 0;
    let k = 4;
    while (k < size) {
        for (i = 0; i < size; i += k * 2) {
            SIMD.Float32x4.store(a, i,
                SIMD.Float32x4.add(
                    SIMD.Float32x4.load(a, i),
                    SIMD.Float32x4.load(a, i + k)
                ));
        }
        k = k << 1;
    }
});

benc.addTest('matrix', 'typed array', () => {
    a = new Float32Array(32);
    b = new Float32Array(32);
    c = new Float32Array(32);
    for (let i = 0; i < 32; i++) {
        b[i] = i * 0.1;
        a[i] = i * 0.1;
    }
}, () => {
    for (let i = 0; i < 10000; i++) {
        c = new Float32Array(32);
        for (let j = 0; j < 16; j += 4) {
            c[j + 0] = a[0] * b[j + 0] + a[4] * b[j + 1] + a[8]  * b[j + 2] + a[12] * b[j + 3]; // 0, 0
            c[j + 1] = a[1] * b[j + 0] + a[5] * b[j + 1] + a[9]  * b[j + 2] + a[13] * b[j + 3]; // 1, 0
            c[j + 2] = a[2] * b[j + 0] + a[6] * b[j + 1] + a[10] * b[j + 2] + a[14] * b[j + 3]; // 2, 0
            c[j + 3] = a[3] * b[j + 0] + a[7] * b[j + 1] + a[11] * b[j + 2] + a[15] * b[j + 3]; // 3, 0
        }
        fakeRes += c[1] * i;
    }
});
benc.addTest('matrix', 'SIMD', () => {
    a = new Float32Array(32);
    b = new Float32Array(32);
    c = new Float32Array(32);
    for (let i = 0; i < 32; i++) {
        b[i] = i * 0.1;
        a[i] = i * 0.1;
    }
}, () => {
    let j = 0;
    let row1, row2, row3, row4;
    let brod1, brod2, brod3, brod4, row;
    for (let i = 0; i < 10000; i++) {
        c = new Float32Array(32);

        row1 = SIMD.Float32x4.load(a, 0);
        row2 = SIMD.Float32x4.load(a, 4);
        row3 = SIMD.Float32x4.load(a, 8);
        row4 = SIMD.Float32x4.load(a, 12);
        for (j = 0; j < 4; j++) {
            d = b[4 * j + 0];
            brod1 = SIMD.Float32x4(d, d, d, d); // у нас нет аналога команды _mm_set1_ps
            d = b[4 * j + 1];
            brod2 = SIMD.Float32x4(d, d, d, d); // у нас нет аналога команды _mm_set1_ps
            d = b[4 * j + 2];
            brod3 = SIMD.Float32x4(d, d, d, d); // у нас нет аналога команды _mm_set1_ps
            d = b[4 * j + 3];
            brod4 = SIMD.Float32x4(d, d, d, d); // у нас нет аналога команды _mm_set1_ps
            row = SIMD.Float32x4.add(
                SIMD.Float32x4.add(
                    SIMD.Float32x4.mul(brod1, row1),
                    SIMD.Float32x4.mul(brod2, row2)
                ),
                SIMD.Float32x4.add(
                    SIMD.Float32x4.mul(brod3, row4),
                    SIMD.Float32x4.mul(brod3, row4)
                )
            );
            SIMD.Float32x4.store(c, j * 4, row);
        }

        fakeRes += c[1];
    }
    fakeRes = a[4];
});


const canvOrigin = document.getElementById('canvOrigin');
const canvTyped = document.getElementById('canvTyped');
const canvSIMD = document.getElementById('canvSIMD');

const ctxOrigin = canvOrigin.getContext('2d');
const ctxTyped = canvTyped.getContext('2d');
const ctxSIMD = canvSIMD.getContext('2d');
const pictureImg = document.getElementById('image');

const width = 400;
const height = 225;

const mul1 = SIMD.Float32x4(-1.0, -1.0, -1.0, 1);
const mul2 = SIMD.Float32x4(-2.0, -2.0, -2.0, 1);
const mul3 = SIMD.Float32x4(1.0, 1.0, 1.0, 1);
const mul4 = SIMD.Float32x4(2.0, 2.0, 2.0, 1);

const smul = SIMD.Float32x4.mul;
const sadd = SIMD.Float32x4.add;
const sloa = SIMD.Float32x4.load;

const toI = (x, y) => (y * width + x) * 4;

const pix = (x, y, i) => {
    let v 	= (a[toI(x-1, y-1) + i] * -1)
        + (a[toI(x-1, y-0) + i] * -2)
        + (a[toI(x-1, y+1) + i] * -1);

    v  += (a[toI(x+1, y-1) + i] * 1)
        + (a[toI(x+1, y-0) + i] * 2)
        + (a[toI(x+1, y+1) + i] * 1);

    let h   = (a[toI(x-1, y-1) + i] * -1)
        + (a[toI(x-0, y-1) + i] * -2)
        + (a[toI(x+1, y-1) + i] * -1);

    h  += (a[toI(x-1, y+1) + i] * 1)
        + (a[toI(x+0, y+1) + i] * 2)
        + (a[toI(x+1, y+1) + i] * 1);

    return Math.min(Math.max(0, Math.sqrt(v * v + h * h)), 255);
};

const pixS = (x, y) => {

    let v = sadd(
        sadd(
            sadd(
                smul(sloa(a, toI(x-1, y-1)), mul1), // 1,1
                smul(sloa(a, toI(x-0, y-1)), mul2) // 2,1
            ),
            sadd(
                smul(sloa(a, toI(x+1, y-1)), mul1), //3,1
                smul(sloa(a, toI(x-1, y+1)), mul3) //1,3
            )
        ),
        sadd(
            smul(sloa(a, toI(x-0, y+1)), mul4), // 1,1
            smul(sloa(a, toI(x+1, y+1)), mul3) // 2,1
        )
    );

    let h = sadd(
        sadd(
            sadd(
                smul(sloa(a, toI(x-1, y-1)), mul1), // 1,1
                smul(sloa(a, toI(x-1, y+0)), mul2) // 2,1
            ),
            sadd(
                smul(sloa(a, toI(x-1, y+1)), mul1), //3,1
                smul(sloa(a, toI(x+1, y-1)), mul3) //1,3
            )
        ),
        sadd(
            smul(sloa(a, toI(x+1, y+0)), mul4), // 1,1
            smul(sloa(a, toI(x+1, y+1)), mul3) // 2,1
        )
    );

    return SIMD.Float32x4.sqrt(
        sadd(
            smul(v, v),
            smul(h, h)
        )
    );
};

const sobel = function() {
    const data = imgTyped.data;
    for (let x = 1; x < width - 1; x++) {
        for (let y = 1; y < height - 1; y++) {
            const i = toI(x, y);
            data[i] = pix(x, y, 0);
            data[i + 1] = pix(x, y, 1);
            data[i + 2] = pix(x, y, 2);
            data[i + 3] = 255;
        }
    }
};


const sobelS = function() {
    for (let x = 1; x < width - 1; x++) {
        for (let y = 1; y < height - 1; y++) {
            const i = toI(x, y);
            const d = pixS(x, y);
            SIMD.Float32x4.store(b, i, d);
        }
    }
};

ctxOrigin.drawImage(pictureImg, 0, 0);
const imgData = ctxOrigin.getImageData(0, 0, width, height);
let imgTyped, imgSIMD;

benc.addTest('sobel', 'typed array', () => {
    imgTyped = ctxTyped.getImageData(0, 0, width, height);
    const data = imgData.data;
    a = Float32Array.from(data);
}, ()=> {
    sobel();
}, () => {
    ctxTyped.putImageData(imgTyped, 0, 0);
});
benc.addTest('sobel', 'SIMD', () => {
    imgSIMD = ctxSIMD.getImageData(0, 0, width, height);
    const data = imgData.data;
    a = Float32Array.from(data);
    b = Float32Array.from(data);
}, ()=> {
    sobelS();
}, () => {
    const data = imgSIMD.data;
    for (let x = 0; x < b.length; x++) {
        data[x] = ((x+1) % 4 === 0) ? 255 : b[x]; // alpha channel fix

    }
    ctxSIMD.putImageData(imgSIMD, 0, 0);
});

const runBtn = document.getElementById('run');
runBtn.onclick = benc.run.bind(benc);
console.log(fakeRes);
