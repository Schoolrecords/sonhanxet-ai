/**
 * Mock data cho test CacheManager + VneduAdapter (Phase 1).
 *
 * Mock 2 thứ:
 *   1. mockClass5A: dữ liệu lớp 5A có 5 HS với điểm khác nhau
 *   2. mockSoNXTable: HTML giả lập bảng Sổ NX môn Tiếng Việt
 *      → dùng để test extractSoNXData() mà không cần real Vnedu
 */

window.MOCK = window.MOCK || {};

// ----- Dữ liệu lớp 5A: 5 HS đại diện 4 tier điểm + 1 HS chưa có điểm -----
window.MOCK.class5A = {
    className: '5A',
    students: [
        {
            stt: 1,
            hoVaTen: 'Ngô Thị Bảo An',
            diem: {
                'tieng-viet': 9,
                'toan': 10,
                'tnxh': 8,
                'khoa-hoc': 9,
                'lich-su-dia': 7,
                'tin-hoc': 8,
                'tieng-anh': 7,
                'am-nhac': 8,
                'mi-thuat': 9
            }
        },
        {
            stt: 2,
            hoVaTen: 'Trần Văn Bình',
            diem: {
                'tieng-viet': 7,
                'toan': 8,
                'tnxh': 7,
                'khoa-hoc': 7,
                'tieng-anh': 6
            }
        },
        {
            stt: 3,
            hoVaTen: 'Lê Thị Cẩm',
            diem: {
                'tieng-viet': 5,
                'toan': 6,
                'tnxh': 5,
                'khoa-hoc': 5
            }
        },
        {
            stt: 4,
            hoVaTen: 'Phạm Văn Đức',
            diem: {
                'tieng-viet': 3,
                'toan': 4,
                'tnxh': 4
            }
        },
        {
            stt: 5,
            hoVaTen: 'Hoàng Thị Em',
            diem: {} // chưa có điểm — test edge case
        }
    ]
};

// ----- HTML mock một bảng Sổ NX môn Tiếng Việt giống cấu trúc Vnedu -----
// Inject vào DOM trước khi chạy extractSoNXData()
window.MOCK.injectSoNXTable = function (className = '5A', monName = 'Tiếng Việt') {
    const wrap = document.createElement('div');
    wrap.id = 'mock-vnedu-wrap';
    wrap.innerHTML = `
        <div class="x-toolbar">
            <span>Sổ nhận xét — Lớp: ${className}    Môn học: ${monName} - Học kỳ 1</span>
        </div>
        <table class="x-grid">
            <thead>
                <tr><th>STT</th><th>Họ và tên</th><th>Điểm</th><th>Nhận xét</th></tr>
            </thead>
            <tbody>
                <tr><td>1</td><td>Ngô Thị Bảo An</td><td><input type="text" value="9"/></td><td><textarea>Em học tốt</textarea></td></tr>
                <tr><td>2</td><td>Trần Văn Bình</td><td><input type="text" value="7"/></td><td><textarea></textarea></td></tr>
                <tr><td>3</td><td>Lê Thị Cẩm</td><td><input type="text" value="5"/></td><td><textarea></textarea></td></tr>
                <tr><td>4</td><td>Phạm Văn Đức</td><td><input type="text" value="3"/></td><td><textarea></textarea></td></tr>
                <tr><td>5</td><td>Hoàng Thị Em</td><td><input type="text" value=""/></td><td><textarea></textarea></td></tr>
            </tbody>
        </table>
        <button>Lưu</button>
    `;
    document.body.appendChild(wrap);
    return wrap;
};

window.MOCK.removeSoNXTable = function () {
    document.getElementById('mock-vnedu-wrap')?.remove();
};

// Mock chrome.storage.local cho test môi trường browser thường (không phải extension)
// Nếu chạy trong context extension thật, biến chrome đã có sẵn → bỏ qua mock
window.MOCK.installChromeStorageMock = function () {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) return false;

    const store = {};
    window.chrome = {
        storage: {
            local: {
                get(keys, cb) {
                    const result = {};
                    const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(store));
                    keyList.forEach(k => { result[k] = store[k]; });
                    setTimeout(() => cb(result), 0);
                },
                set(obj, cb) {
                    Object.assign(store, obj);
                    setTimeout(() => cb && cb(), 0);
                },
                remove(keys, cb) {
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    keyList.forEach(k => delete store[k]);
                    setTimeout(() => cb && cb(), 0);
                }
            }
        },
        runtime: { lastError: null }
    };
    return true;
};
