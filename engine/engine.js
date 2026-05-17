/**
 * NhanXetEngine v2.0 - Phiên bản NGẮN GỌN
 *
 * Khác với v1:
 *   - KHÔNG còn composition (opener + content + encouragement)
 *   - Mỗi phrase là 1 câu hoàn chỉnh 12-18 từ
 *   - KHÔNG chèn tên HS, chỉ dùng "em"
 *   - Anti-duplication: 1 lớp không lặp lại phrase
 *
 * Bám sát học bạ tiểu học chuẩn TT27/2020
 */

class NhanXetEngineV2 {
    constructor(options = {}) {
        this.options = {
            antiDupLevel: 'normal',
            ...options
        };
        this.data = null;
        this.usedPhrases = new Set();
    }

    loadData(data) {
        this.data = data;
        return this;
    }

    phanLoaiMuc(diem) {
        if (diem === null || diem === undefined) return 'ht';
        const d = parseFloat(diem);
        if (isNaN(d)) return 'ht';
        if (d >= 9) return 'tot_xs';
        if (d >= 7) return 'tot';
        if (d >= 5) return 'ht';
        return 'cht';
    }

    xepLoaiText(mucDo) {
        if (mucDo === 'tot_xs' || mucDo === 'tot') return 'T';
        if (mucDo === 'ht') return 'H';
        if (mucDo === 'cht') return 'C';
        return 'H';
    }

    xepLoaiBadge(mucDo) {
        if (mucDo === 'tot_xs') return 'T+';
        if (mucDo === 'tot') return 'T';
        if (mucDo === 'ht') return 'H';
        if (mucDo === 'cht') return 'C';
        return 'H';
    }

    randInt(max) {
        return Math.floor(Math.random() * max);
    }

    chonNgauNhien(arr) {
        if (!arr || arr.length === 0) return null;
        return arr[this.randInt(arr.length)];
    }

    chonKhongTrungLap(pool) {
        if (!pool || pool.length === 0) return null;

        const available = pool.filter(p => !this.usedPhrases.has(p));

        if (available.length === 0) {
            this.usedPhrases.clear();
            return this.chonNgauNhien(pool);
        }

        const phrase = this.chonNgauNhien(available);
        this.usedPhrases.add(phrase);
        return phrase;
    }

    resetUsedPhrases() {
        this.usedPhrases.clear();
    }

    sinhNhanXet(hs, subjectCode) {
        if (!this.data || !this.data.subjects) {
            return 'Em chăm chỉ học tập và có nhiều tiến bộ trong học kì này.';
        }

        const subject = this.data.subjects[subjectCode];
        if (!subject) {
            return 'Em chăm chỉ học tập và có nhiều tiến bộ trong học kì này.';
        }

        // Ưu tiên mucDat (mức chữ T/H/C cho môn không có điểm — TNXH, ĐĐ, MT...)
        // Sau đó mới phân loại từ điểm số.
        const mucDo = hs.mucDat || this.phanLoaiMuc(hs.diem);
        const pool = subject[mucDo] || subject.ht || [];

        const phrase = this.chonKhongTrungLap(pool);

        return this.applyGvPersona(phrase) || 'Em chăm chỉ học tập và có nhiều tiến bộ.';
    }

    applyGvPersona(text) {
        if (!text) return text;
        if (this.options.gvLa !== 'thay') return text;

        const tokens = text.split(/(\s+|[.,!?;:\-\(\)])/);
        const result = [];

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token === 'cô' || token === 'Cô') {
                let prevIdx = i - 1;
                while (prevIdx >= 0 && /^\s+$/.test(tokens[prevIdx])) prevIdx--;
                const prevToken = prevIdx >= 0 ? tokens[prevIdx] : null;

                if (prevToken === 'thầy' || prevToken === 'Thầy') {
                    result.push(token);
                } else {
                    result.push(token === 'cô' ? 'thầy' : 'Thầy');
                }
            } else {
                result.push(token);
            }
        }

        return result.join('');
    }

    sinhCaLop(danhSachHS, subjectCode) {
        this.resetUsedPhrases();

        return danhSachHS.map(hs => {
            const nhanXet = this.sinhNhanXet(hs, subjectCode);
            // Ưu tiên mucDat (môn không điểm) trước phân loại theo điểm
            const mucDo = hs.mucDat || this.phanLoaiMuc(hs.diem);

            return {
                stt: hs.stt,
                hoVaTen: hs.hoVaTen,
                diem: hs.diem,
                mucDat: hs.mucDat,
                mucDo: mucDo,
                xepLoai: this.xepLoaiText(mucDo),
                badge: this.xepLoaiBadge(mucDo),
                nhanXet: nhanXet
            };
        });
    }

    sinhNLPCDayDu(hsContext, danhGia) {
        if (!this.data || !this.data.nlpc) {
            throw new Error('Chưa có dữ liệu NLPC');
        }

        const result = {
            nang_luc_chung: {},
            nang_luc_dac_thu: {},
            pham_chat: {}
        };

        const tongHopMuc = (dgObj) => {
            const c = { tot: 0, ht: 0, cht: 0 };
            Object.values(dgObj).forEach(m => { if (c[m] !== undefined) c[m]++; });
            if (c.cht > 0) return 'cht';
            if (c.ht >= c.tot) return 'ht';
            return 'tot';
        };

        const pickFrom = (branch, mucDo) => {
            const pool = branch[mucDo] || branch.ht || [];
            const phrase = this.chonKhongTrungLap(pool) || '';
            return this._enrichNLPCPhrase(phrase, mucDo);
        };

        const nlpc = this.data.nlpc;

        const mucNLC = tongHopMuc(danhGia.nang_luc_chung || {});
        result.nang_luc_chung['Nhận xét chung'] = pickFrom(nlpc.nang_luc_chung.nhan_xet_chung, mucNLC);
        for (const key of ['tu_chu_tu_hoc', 'giao_tiep_hop_tac', 'giai_quyet_van_de']) {
            const mucDo = (danhGia.nang_luc_chung || {})[key] || 'ht';
            result.nang_luc_chung[this._getNLCLabel(key)] = pickFrom(nlpc.nang_luc_chung[key], mucDo);
        }

        const mucNLDT = tongHopMuc(danhGia.nang_luc_dac_thu || {});
        result.nang_luc_dac_thu['Nhận xét chung'] = pickFrom(nlpc.nang_luc_dac_thu.nhan_xet_chung, mucNLDT);
        // V1.5: Năng lực Khoa học chỉ áp dụng lớp 4-5 (CT GDPT 2018 — môn Khoa học bắt đầu từ
        // lớp 4; lớp 1-3 chỉ học TNXH). Lớp 3-5 thêm Công nghệ + Tin học (TT27 quy định).
        // Khi KHÔNG detect được gradeLevel → MẶC ĐỊNH thêm đủ (an toàn cho lớp 4-5).
        const nldtKeys = ['ngon_ngu', 'tinh_toan', 'tham_mi', 'the_chat'];
        const gradeLevel = hsContext?.gradeLevel;
        if (gradeLevel == null || gradeLevel >= 4) {
            nldtKeys.splice(2, 0, 'khoa_hoc');
        }
        if (gradeLevel == null || gradeLevel >= 3) {
            nldtKeys.push('cong_nghe', 'tin_hoc');
        }
        for (const key of nldtKeys) {
            const mucDo = (danhGia.nang_luc_dac_thu || {})[key] || 'ht';
            result.nang_luc_dac_thu[this._getNLDTLabel(key)] = pickFrom(nlpc.nang_luc_dac_thu[key], mucDo);
        }

        const mucPC = tongHopMuc(danhGia.pham_chat || {});
        result.pham_chat['Nhận xét chung'] = pickFrom(nlpc.pham_chat.nhan_xet_chung, mucPC);
        for (const key of ['yeu_nuoc', 'nhan_ai', 'cham_chi', 'trung_thuc', 'trach_nhiem']) {
            const mucDo = (danhGia.pham_chat || {})[key] || 'ht';
            result.pham_chat[this._getPCLabel(key)] = pickFrom(nlpc.pham_chat[key], mucDo);
        }

        return result;
    }

    _getNLCLabel(key) {
        return {
            tu_chu_tu_hoc: 'Tự chủ và tự học',
            giao_tiep_hop_tac: 'Giao tiếp và hợp tác',
            giai_quyet_van_de: 'Giải quyết vấn đề và sáng tạo'
        }[key] || key;
    }

    _getNLDTLabel(key) {
        return {
            ngon_ngu: 'Năng lực ngôn ngữ',
            tinh_toan: 'Năng lực tính toán',
            khoa_hoc: 'Năng lực khoa học',
            tham_mi: 'Năng lực thẩm mĩ',
            the_chat: 'Năng lực thể chất',
            cong_nghe: 'Năng lực công nghệ',
            tin_hoc: 'Năng lực tin học'
        }[key] || key;
    }

    _getPCLabel(key) {
        return {
            yeu_nuoc: 'Yêu nước',
            nhan_ai: 'Nhân ái',
            cham_chi: 'Chăm chỉ',
            trung_thuc: 'Trung thực',
            trach_nhiem: 'Trách nhiệm'
        }[key] || key;
    }

    /**
     * v0.1.11 — Enrich NLPC phrase: nếu câu < minLen ký tự thì append 1 vế bổ sung
     * cho đủ ý + dài đúng yêu cầu Vnedu (≥65 ký tự).
     *
     * Vế bổ sung pick từ NhanXetEngineV2.NLPC_ENRICH_BANK theo tier (tot/ht/cht).
     * Cách insert: bỏ dấu chấm cuối, append " " + enrich + ".".
     */
    _enrichNLPCPhrase(phrase, tier, minLen = 65) {
        if (!phrase || phrase.length >= minLen) return phrase;
        const bank = NhanXetEngineV2.NLPC_ENRICH_BANK;
        const pool = bank[tier] || bank.ht;
        const enrich = this.chonNgauNhien(pool);
        if (!enrich) return phrase;
        return phrase.replace(/[\.\s]+$/, '') + ' ' + enrich + '.';
    }
}

// Pool vế bổ sung để enrich câu NLPC < 65 ký tự lên ~75-95 ký tự.
// Mỗi vế ~10-25 ký tự, đa dạng để câu không bị lặp khi enrich nhiều HS.
NhanXetEngineV2.NLPC_ENRICH_BANK = Object.freeze({
    tot: [
        'rất tốt',
        'một cách chủ động',
        'thường xuyên trong lớp',
        'có hiệu quả cao',
        'đáng được tuyên dương',
        'trong mọi hoạt động chung',
        'rất xứng đáng được khen',
        'qua từng tuần học'
    ],
    ht: [
        'hằng ngày',
        'qua từng tuần học',
        'theo hướng dẫn của thầy cô',
        'trong các hoạt động chung của lớp',
        'dần dần qua thời gian',
        'từng bước một',
        'theo yêu cầu của bài học',
        'cùng các bạn trong lớp'
    ],
    cht: [
        'với sự hỗ trợ của thầy cô',
        'từng chút một',
        'mỗi ngày một ít',
        'theo hướng dẫn cụ thể',
        'cùng các bạn trong nhóm',
        'qua sự nhắc nhở của thầy cô'
    ]
});

/* ========================================================================
 * CacheManager v0.1.5 — Quản lý cache điểm môn vào chrome.storage.local
 *
 * Mục đích:
 *   - Tích lũy SILENT điểm các môn (TV, Toán, TNXH, KH, LSĐL, ÂN, MT, ...)
 *   - Mỗi lần GV mở Sổ NX 1 môn → tự lưu vào cache
 *   - Khi mở Form NLPC → đọc cache để auto-suggest 6 trường NL/PC
 *
 * Cấu trúc lưu chrome.storage.local:
 *   classCache: {
 *     "5A": {
 *       lastUpdated: ISO timestamp,
 *       students: {
 *         "Ngô Thị Bảo An": {
 *           id: "SV001",
 *           diem: { "tieng-viet": 9, "toan": 10, ... "diem-tb": 8.3 },
 *           lastSynced: ISO timestamp
 *         }
 *       }
 *     }
 *   }
 *
 * Performance target: cache lookup < 100ms (chrome.storage.local ~10-50ms).
 * ====================================================================== */

const CACHE_ROOT_KEY = 'classCache';

// Danh sách subject key chuẩn — KHÔNG được thêm key lạ ngoài danh sách này
// để giữ schema ổn định cho NLPCMapper (Phase 3)
const VALID_SUBJECTS = Object.freeze([
    'tieng-viet',
    'toan',
    'tnxh',
    'khoa-hoc',
    'lich-su-dia',
    'dao-duc',
    'tin-hoc',
    'cong-nghe',
    'tieng-anh',
    'gd-the-chap',
    'am-nhac',
    'mi-thuat',
    'htn',
    'diem-tb'
]);

// Map tên môn từ Vnedu (tự do, có dấu) → subject key chuẩn
// Khi Vnedu hiển thị "Tiếng Việt" → normalize thành "tieng-viet"
const SUBJECT_NAME_MAP = Object.freeze({
    'tieng viet': 'tieng-viet',
    'tv': 'tieng-viet',
    'toan': 'toan',
    'tu nhien va xa hoi': 'tnxh',
    'tu nhien xa hoi': 'tnxh',
    'tnxh': 'tnxh',
    'tn xh': 'tnxh',          // BUG-003 fix: "TN-XH" → normalize "tn xh"
    'tn': 'tnxh',             // BUG-003 fix: fallback nếu vẫn bị cắt thành "TN"
    'khoa hoc': 'khoa-hoc',
    'kh': 'khoa-hoc',
    'lich su va dia li': 'lich-su-dia',
    'lich su dia li': 'lich-su-dia',
    'lich su va dia ly': 'lich-su-dia',
    'lsdl': 'lich-su-dia',
    'dao duc': 'dao-duc',
    'dd': 'dao-duc',
    'tin hoc': 'tin-hoc',
    'tin hoc va cong nghe': 'tin-hoc',
    'cong nghe': 'cong-nghe',
    'tieng anh': 'tieng-anh',
    'ta': 'tieng-anh',
    'giao duc the chat': 'gd-the-chap',
    'the duc': 'gd-the-chap',
    'gdtc': 'gd-the-chap',
    'am nhac': 'am-nhac',
    'an': 'am-nhac',
    'mi thuat': 'mi-thuat',
    'my thuat': 'mi-thuat',
    'mt': 'mi-thuat',
    'hoat dong trai nghiem': 'htn',
    'htn': 'htn',
    'diem trung binh': 'diem-tb',
    'diem tb': 'diem-tb'
});

class CacheManager {
    /**
     * Chuẩn hóa tên môn từ Vnedu thành subject key.
     * Bỏ dấu, lowercase, trim, rồi tra SUBJECT_NAME_MAP.
     * Trả null nếu không tìm thấy (để caller log warning).
     */
    static normalizeSubject(subjectRaw) {
        if (!subjectRaw || typeof subjectRaw !== 'string') return null;

        // V1.7: phân biệt Tin học vs Công nghệ TRƯỚC khi strip parenthetical.
        // Vnedu thường hiện 2 cột con dưới "Tin học và Công nghệ":
        //   "Tin học và Công nghệ (Tin học)"  → 'tin-hoc'   (xử lý ở BUG-005 strip phía dưới)
        //   "Tin học và Công nghệ (Công nghệ)" → 'cong-nghe' (BẮT Ở ĐÂY)
        //   "Công nghệ" riêng                 → 'cong-nghe'
        const rawNoAccent = subjectRaw
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/đ/g, 'd');
        if (/\(\s*cong nghe\s*\)/.test(rawNoAccent)) return 'cong-nghe';
        if (rawNoAccent.includes('cong nghe') && !rawNoAccent.includes('tin hoc')) return 'cong-nghe';

        // BUG-005 fix: strip parenthetical suffix vd "Tin học và Công nghệ (Tin học)"
        // → "Tin học và Công nghệ" để match alias chuẩn
        let cleaned = subjectRaw.replace(/\s*\([^)]*\)\s*/g, ' ').trim();

        // Nếu đã là key chuẩn thì trả luôn
        const trimmed = cleaned.toLowerCase();
        if (VALID_SUBJECTS.includes(trimmed)) return trimmed;

        // Bỏ dấu tiếng Việt + ký tự đặc biệt
        const noAccent = trimmed
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/đ/g, 'd')
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (SUBJECT_NAME_MAP[noAccent]) return SUBJECT_NAME_MAP[noAccent];

        // Fallback: substring match — ưu tiên alias dài nhất để tránh false-positive
        // (vd "tieng anh" includes "an" → tránh match nhầm "am-nhac")
        const sortedAliases = Object.keys(SUBJECT_NAME_MAP).sort((a, b) => b.length - a.length);
        for (const alias of sortedAliases) {
            if (alias.length >= 4 && noAccent.includes(alias)) {
                return SUBJECT_NAME_MAP[alias];
            }
        }
        return null;
    }

    /**
     * Validate điểm: phải là number 0-10 hoặc null (chưa có điểm).
     * Trả về điểm đã clean, hoặc throw nếu không hợp lệ.
     */
    static validateScore(score) {
        if (score === null || score === undefined || score === '') return null;

        const n = typeof score === 'number' ? score : parseFloat(String(score).replace(',', '.'));
        if (isNaN(n)) {
            throw new Error(`Điểm không hợp lệ: "${score}" — phải là số 0-10 hoặc null`);
        }
        if (n < 0 || n > 10) {
            throw new Error(`Điểm ngoài phạm vi: ${n} — phải nằm trong [0, 10]`);
        }
        return Math.round(n * 100) / 100;
    }

    /**
     * Validate className: non-empty, trim, max 20 ký tự.
     * Format chuẩn Vnedu: "5A", "1B", "4C"... nhưng có thể có biến thể.
     */
    static validateClassName(className) {
        if (!className || typeof className !== 'string') {
            throw new Error('className phải là chuỗi không rỗng');
        }
        const trimmed = className.trim();
        if (!trimmed) throw new Error('className rỗng sau khi trim');
        if (trimmed.length > 20) throw new Error(`className quá dài: "${trimmed}"`);
        return trimmed;
    }

    /**
     * Validate studentId: dùng tên HS làm key (vì Vnedu không expose stable id).
     * Tên phải có ít nhất 2 từ (họ + tên), tối đa 60 ký tự.
     */
    static validateStudentId(studentId) {
        if (!studentId || typeof studentId !== 'string') {
            throw new Error('studentId phải là chuỗi không rỗng');
        }
        const trimmed = studentId.replace(/\s+/g, ' ').trim();
        if (trimmed.length < 3 || trimmed.length > 60) {
            throw new Error(`studentId không hợp lệ: "${studentId}" — độ dài 3-60`);
        }
        return trimmed;
    }

    /**
     * Đọc toàn bộ classCache từ chrome.storage.local.
     * Trả {} nếu chưa có gì.
     */
    static async _readRoot() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            // Fallback memory cho Node test runner
            CacheManager._memFallback = CacheManager._memFallback || {};
            return CacheManager._memFallback;
        }
        return new Promise((resolve, reject) => {
            chrome.storage.local.get([CACHE_ROOT_KEY], (result) => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                resolve(result[CACHE_ROOT_KEY] || {});
            });
        });
    }

    static async _writeRoot(root) {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            CacheManager._memFallback = root;
            return;
        }
        return new Promise((resolve, reject) => {
            chrome.storage.local.set({ [CACHE_ROOT_KEY]: root }, () => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                resolve();
            });
        });
    }

    /**
     * Khởi tạo cache cho 1 lớp (idempotent — không ghi đè dữ liệu cũ).
     * Dùng khi GV vừa mở Vnedu lần đầu trong session.
     */
    static async initCache(className) {
        try {
            const cls = CacheManager.validateClassName(className);
            const root = await CacheManager._readRoot();

            if (!root[cls]) {
                root[cls] = {
                    lastUpdated: new Date().toISOString(),
                    students: {}
                };
                await CacheManager._writeRoot(root);
                console.log(`[CacheManager] Đã khởi tạo cache cho lớp ${cls}`);
            }
            return root[cls];
        } catch (e) {
            console.error('[CacheManager] initCache lỗi:', e);
            throw e;
        }
    }

    /**
     * Lưu điểm 1 môn của 1 HS. Auto init nếu chưa có.
     * Trả về object student vừa update.
     */
    static async syncScore(className, studentId, subject, score) {
        try {
            const cls = CacheManager.validateClassName(className);
            const sid = CacheManager.validateStudentId(studentId);

            const subjectKey = CacheManager.normalizeSubject(subject);
            if (!subjectKey) {
                throw new Error(`Môn không nhận ra: "${subject}". Subject hợp lệ: ${VALID_SUBJECTS.join(', ')}`);
            }

            const cleanScore = CacheManager.validateScore(score);

            const root = await CacheManager._readRoot();
            if (!root[cls]) {
                root[cls] = { lastUpdated: new Date().toISOString(), students: {} };
            }
            if (!root[cls].students[sid]) {
                root[cls].students[sid] = {
                    id: sid,
                    diem: {},
                    lastSynced: new Date().toISOString()
                };
            }

            root[cls].students[sid].diem[subjectKey] = cleanScore;
            root[cls].students[sid].lastSynced = new Date().toISOString();
            root[cls].lastUpdated = new Date().toISOString();

            await CacheManager._writeRoot(root);

            return root[cls].students[sid];
        } catch (e) {
            console.error(`[CacheManager] syncScore(${className}, ${studentId}, ${subject}, ${score}) lỗi:`, e);
            throw e;
        }
    }

    /**
     * Sync nhiều HS cùng môn trong 1 lần ghi (gom batch để tránh nhiều
     * chrome.storage.set liên tiếp). Dùng khi extract xong cả bảng Sổ NX.
     *
     * @param className tên lớp
     * @param subject tên môn raw từ Vnedu
     * @param entries [{ studentId, score }]
     * @returns { synced: số HS lưu thành công, skipped: [{studentId, reason}] }
     */
    static async syncBatch(className, subject, entries) {
        try {
            const cls = CacheManager.validateClassName(className);
            const subjectKey = CacheManager.normalizeSubject(subject);
            if (!subjectKey) {
                throw new Error(`Môn không nhận ra: "${subject}"`);
            }
            if (!Array.isArray(entries)) {
                throw new Error('entries phải là array');
            }

            const root = await CacheManager._readRoot();
            if (!root[cls]) {
                root[cls] = { lastUpdated: new Date().toISOString(), students: {} };
            }

            const now = new Date().toISOString();
            const skipped = [];
            let synced = 0;

            for (const entry of entries) {
                try {
                    const sid = CacheManager.validateStudentId(entry.studentId);
                    const cleanScore = CacheManager.validateScore(entry.score);

                    if (!root[cls].students[sid]) {
                        root[cls].students[sid] = { id: sid, diem: {}, lastSynced: now };
                    }
                    root[cls].students[sid].diem[subjectKey] = cleanScore;
                    root[cls].students[sid].lastSynced = now;
                    synced++;
                } catch (e) {
                    skipped.push({ studentId: entry.studentId, reason: e.message });
                }
            }

            root[cls].lastUpdated = now;
            await CacheManager._writeRoot(root);

            console.log(`[CacheManager] syncBatch lớp ${cls} môn ${subjectKey}: ${synced} thành công, ${skipped.length} skip`);
            return { synced, skipped };
        } catch (e) {
            console.error(`[CacheManager] syncBatch(${className}, ${subject}) lỗi:`, e);
            throw e;
        }
    }

    /**
     * Lấy toàn bộ điểm của 1 HS (target < 100ms).
     * Trả null nếu chưa có cache.
     */
    static async getStudentScores(className, studentId) {
        try {
            const cls = CacheManager.validateClassName(className);
            const sid = CacheManager.validateStudentId(studentId);

            const root = await CacheManager._readRoot();
            const studentObj = root[cls]?.students?.[sid];
            if (!studentObj) return null;

            return {
                id: studentObj.id,
                diem: { ...studentObj.diem },
                lastSynced: studentObj.lastSynced
            };
        } catch (e) {
            console.error(`[CacheManager] getStudentScores lỗi:`, e);
            return null;
        }
    }

    /**
     * Lấy toàn bộ data của 1 lớp (cho Tab Cache Monitor — Phase 2).
     */
    static async getClassCache(className) {
        try {
            const cls = CacheManager.validateClassName(className);
            const root = await CacheManager._readRoot();
            return root[cls] || null;
        } catch (e) {
            console.error('[CacheManager] getClassCache lỗi:', e);
            return null;
        }
    }

    /**
     * Liệt kê tên các lớp đang có trong cache.
     */
    static async listClasses() {
        const root = await CacheManager._readRoot();
        return Object.keys(root);
    }

    /**
     * Thống kê cache (cho debug Tab Cache Monitor).
     * { totalClasses, totalStudents, totalScoreEntries, byClass: {...} }
     */
    static async getCacheStats() {
        const root = await CacheManager._readRoot();
        const stats = {
            totalClasses: 0,
            totalStudents: 0,
            totalScoreEntries: 0,
            byClass: {}
        };

        for (const [cls, data] of Object.entries(root)) {
            const studentCount = Object.keys(data.students || {}).length;
            let scoreCount = 0;
            for (const s of Object.values(data.students || {})) {
                scoreCount += Object.values(s.diem || {}).filter(v => v !== null && v !== undefined).length;
            }
            stats.totalClasses++;
            stats.totalStudents += studentCount;
            stats.totalScoreEntries += scoreCount;
            stats.byClass[cls] = {
                students: studentCount,
                scores: scoreCount,
                lastUpdated: data.lastUpdated
            };
        }
        return stats;
    }

    /**
     * Reset toàn bộ cache (debug). Dùng cho nút "Reset Cache" trong Tab 1.
     */
    static async clearCache() {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            CacheManager._memFallback = {};
            return;
        }
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove([CACHE_ROOT_KEY], () => {
                if (chrome.runtime.lastError) {
                    return reject(new Error(chrome.runtime.lastError.message));
                }
                console.log('[CacheManager] Đã xóa toàn bộ classCache');
                resolve();
            });
        });
    }

    /**
     * Xóa cache của 1 lớp cụ thể (giữ các lớp khác).
     */
    static async clearClass(className) {
        const cls = CacheManager.validateClassName(className);
        const root = await CacheManager._readRoot();
        if (root[cls]) {
            delete root[cls];
            await CacheManager._writeRoot(root);
            console.log(`[CacheManager] Đã xóa cache lớp ${cls}`);
        }
    }
}

// Expose constants để consumer (vnedu-adapter, sidebar) dùng được
CacheManager.VALID_SUBJECTS = VALID_SUBJECTS;
CacheManager.SUBJECT_NAME_MAP = SUBJECT_NAME_MAP;

/* ========================================================================
 * NLPCMapper v0.1.8 — Suy TỰ ĐỘNG cả 13 trường NL/PC từ điểm môn
 *
 * Theo TT27/2020 đánh giá HS Tiểu học, NL/PC dùng 3 MỨC:
 *   - T (Tốt)
 *   - Đ (Đạt)
 *   - C (Cần cố gắng)
 *
 * Quyết định nghiệp vụ (anh Chung TH Diễn Liên 2026-05-15):
 *   "Phần mềm phải hướng đến tự động hoá CẢ 16 trường, căn cứ điểm số +
 *    mức độ hoàn thành để có lời nhận xét đúng yêu cầu TT27."
 *   → 13 trường con đều suy auto. GV có thể click badge để override khi cần.
 *
 * Mapping cho 13 trường (3 NL chung + 5 NL đặc thù + 5 PC):
 *   NL chung:
 *     - tu_chu_tu_hoc          ← TB toàn bộ môn (HS tự học → điểm đều cao)
 *     - giao_tiep_hop_tac      ← TV + TA + HĐTN (môn cần kỹ năng giao tiếp)
 *     - giai_quyet_van_de      ← Toán + KH + TNXH (môn cần tư duy GQVĐ)
 *   NL đặc thù:
 *     - ngon_ngu               ← TV + TA
 *     - tinh_toan              ← Toán
 *     - khoa_hoc               ← TNXH + KH + LSĐL
 *     - tham_mi                ← ÂN + MT
 *     - the_chat               ← GDTC
 *   Phẩm chất:
 *     - yeu_nuoc               ← LSĐL + ĐĐ
 *     - nhan_ai                ← ĐĐ + TV
 *     - cham_chi               ← Điểm TB (fallback avg toàn bộ)
 *     - trung_thuc             ← ĐĐ + TB toàn bộ
 *     - trach_nhiem            ← ĐĐ + HĐTN + TB toàn bộ
 *
 * Tier theo avg:
 *   avg ≥ 8       → 'tot' (T - Tốt)
 *   avg 5–7.99    → 'ht'  (Đ - Đạt) — internal key 'ht' giữ tương thích nhanxet-ngan.json
 *   avg < 5       → 'cht' (C - Cần cố gắng)
 *   không cache   → 'ht'  (Đ default an toàn — TT27 ưu tiên không khắt khe)
 *
 * Output:
 *   { tu_chu_tu_hoc: { grade:'tot', badge:'T', avg:8.5,
 *                      sources:[{key,label,score},...],
 *                      hint: 'TB toàn bộ: 8.5 → T' }, ... }
 * ====================================================================== */

// Internal grade key: 'tot' | 'ht' | 'cht' (giữ tương thích nhanxet-ngan.json đã có)
// Display badge: T / Đ / C (TT27)

const NLPC_FIELD_RULES = Object.freeze({
    // NĂNG LỰC CHUNG (3 trường)
    tu_chu_tu_hoc: {
        label: 'Tự chủ và tự học',
        section: 'nang_luc_chung',
        // Tự học tốt → điểm đều cao → dùng TB toàn bộ
        sources: [{ key: 'diem-tb', label: 'Điểm TB' }],
        fallbackAllSubjects: true
    },
    giao_tiep_hop_tac: {
        label: 'Giao tiếp và hợp tác',
        section: 'nang_luc_chung',
        sources: [
            { key: 'tieng-viet', label: 'TV' },
            { key: 'tieng-anh', label: 'TA' },
            { key: 'htn', label: 'HĐTN' }
        ]
    },
    giai_quyet_van_de: {
        label: 'GQVĐ và sáng tạo',
        section: 'nang_luc_chung',
        sources: [
            { key: 'toan', label: 'Toán' },
            { key: 'khoa-hoc', label: 'KH' },
            { key: 'tnxh', label: 'TNXH' }
        ]
    },

    // NĂNG LỰC ĐẶC THÙ (5 trường)
    ngon_ngu: {
        label: 'Năng lực Ngôn ngữ',
        section: 'nang_luc_dac_thu',
        sources: [
            { key: 'tieng-viet', label: 'TV' },
            { key: 'tieng-anh', label: 'TA' }
        ]
    },
    tinh_toan: {
        label: 'Năng lực Tính toán',
        section: 'nang_luc_dac_thu',
        sources: [{ key: 'toan', label: 'Toán' }]
    },
    khoa_hoc: {
        label: 'Năng lực Khoa học',
        section: 'nang_luc_dac_thu',
        sources: [
            { key: 'tnxh', label: 'TNXH' },
            { key: 'khoa-hoc', label: 'KH' },
            { key: 'lich-su-dia', label: 'LSĐL' }
        ]
    },
    tham_mi: {
        label: 'Năng lực Thẩm mĩ',
        section: 'nang_luc_dac_thu',
        sources: [
            { key: 'am-nhac', label: 'ÂN' },
            { key: 'mi-thuat', label: 'MT' }
        ]
    },
    the_chat: {
        label: 'Năng lực Thể chất',
        section: 'nang_luc_dac_thu',
        sources: [{ key: 'gd-the-chap', label: 'GDTC' }]
    },
    // BUG-006/V1.7: Lớp 3-5 thêm Công nghệ + Tin học (TT27/2020 + CT GDPT 2018).
    // NL Công nghệ ưu tiên cache 'cong-nghe'; nếu trường chỉ cache combined "Tin học và
    // Công nghệ" (→ 'tin-hoc') thì fallback dùng điểm 'tin-hoc' để tránh default Đ.
    cong_nghe: {
        label: 'Năng lực Công nghệ',
        section: 'nang_luc_dac_thu',
        sources: [{ key: 'cong-nghe', label: 'CN' }, { key: 'tin-hoc', label: 'Tin' }]
    },
    tin_hoc: {
        label: 'Năng lực Tin học',
        section: 'nang_luc_dac_thu',
        sources: [{ key: 'tin-hoc', label: 'Tin' }]
    },

    // PHẨM CHẤT (5 trường)
    yeu_nuoc: {
        label: 'Yêu nước',
        section: 'pham_chat',
        sources: [
            { key: 'lich-su-dia', label: 'LSĐL' },
            { key: 'dao-duc', label: 'ĐĐ' }
        ]
    },
    nhan_ai: {
        label: 'Nhân ái',
        section: 'pham_chat',
        sources: [
            { key: 'dao-duc', label: 'ĐĐ' },
            { key: 'tieng-viet', label: 'TV' }
        ]
    },
    cham_chi: {
        label: 'Chăm chỉ',
        section: 'pham_chat',
        sources: [{ key: 'diem-tb', label: 'Điểm TB' }],
        fallbackAllSubjects: true
    },
    trung_thuc: {
        label: 'Trung thực',
        section: 'pham_chat',
        sources: [
            { key: 'dao-duc', label: 'ĐĐ' },
            { key: 'diem-tb', label: 'Điểm TB' }
        ],
        fallbackAllSubjects: true
    },
    trach_nhiem: {
        label: 'Trách nhiệm',
        section: 'pham_chat',
        sources: [
            { key: 'dao-duc', label: 'ĐĐ' },
            { key: 'htn', label: 'HĐTN' },
            { key: 'diem-tb', label: 'Điểm TB' }
        ],
        fallbackAllSubjects: true
    }
});

class NLPCMapper {
    /**
     * Phân tier 3 mức TT27/2020 cho NL/PC.
     *   avg ≥ 8       → 'tot' (T)
     *   avg 5–7.99    → 'ht'  (Đ)  ← internal key 'ht' giữ tương thích nhanxet-ngan.json
     *   avg < 5       → 'cht' (C)
     *   avg null      → null (caller quyết default; UI default 'ht' = Đ)
     */
    static avgToGrade(avg) {
        if (avg === null || avg === undefined || isNaN(avg)) return null;
        if (avg >= 8) return 'tot';
        if (avg >= 5) return 'ht';
        return 'cht';
    }

    /** Map grade key → badge text hiển thị UI (TT27 NL/PC: T / Đ / C) */
    static gradeToBadge(grade) {
        return { tot: 'T', ht: 'Đ', cht: 'C' }[grade] || 'Đ';
    }

    /** Cycle qua 3 mức khi GV click badge để override: T → Đ → C → T */
    static cycleGrade(currentGrade) {
        const order = ['tot', 'ht', 'cht'];
        const idx = order.indexOf(currentGrade);
        return order[(idx + 1) % order.length];
    }

    /** Tính trung bình các điểm hợp lệ; trả null nếu không có điểm nào */
    static _avgOf(scores) {
        const valid = scores.filter(s => s !== null && s !== undefined && !isNaN(s));
        if (valid.length === 0) return null;
        const sum = valid.reduce((a, b) => a + b, 0);
        return Math.round((sum / valid.length) * 100) / 100;
    }

    /**
     * Map 1 trường NLPC theo rule.
     * Trả: { grade, badge, avg, sources:[{key,label,score}], hint, isDefault }
     * - Có cache: grade theo avg (3 mức T/Đ/C)
     * - Không cache: grade='ht' (Đ — default an toàn TT27), isDefault=true
     */
    static _mapOneField(rule, diemObj) {
        let sources = rule.sources
            .map(s => ({ ...s, score: diemObj[s.key] }))
            .filter(s => s.score !== null && s.score !== undefined);

        // Fallback "tất cả môn" cho các trường tổng hợp (Tự chủ, Chăm chỉ, Trung thực, Trách nhiệm)
        if (sources.length === 0 && rule.fallbackAllSubjects) {
            sources = Object.entries(diemObj)
                .filter(([k, v]) => k !== 'diem-tb' && v !== null && v !== undefined)
                .map(([k, v]) => ({ key: k, label: this._shortLabel(k), score: v }));
        }

        // Default Đ khi không có cache (theo quyết định nghiệp vụ: tự động hoá toàn bộ,
        // GV xem lại nếu thấy không phù hợp)
        if (sources.length === 0) {
            return {
                grade: 'ht',
                badge: 'Đ',
                avg: null,
                sources: [],
                hint: '(chưa có cache → mặc định Đạt)',
                isDefault: true
            };
        }

        const avg = this._avgOf(sources.map(s => s.score));
        const grade = this.avgToGrade(avg);
        const badge = this.gradeToBadge(grade);

        // Hint format: "TV:9, TA:7 → Đ (8.0)" hoặc "Toán:10 → T"
        const srcText = sources.map(s => `${s.label}:${s.score}`).join(', ');
        const hint = sources.length === 1
            ? `${srcText} → ${badge}`
            : `${srcText} → ${badge} (${avg.toFixed(1)})`;

        return { grade, badge, avg, sources, hint, isDefault: false };
    }

    static _shortLabel(subjectKey) {
        return {
            'tieng-viet': 'TV', 'toan': 'Toán', 'tnxh': 'TNXH', 'khoa-hoc': 'KH',
            'lich-su-dia': 'LSĐL', 'dao-duc': 'ĐĐ', 'tin-hoc': 'Tin', 'cong-nghe': 'CN',
            'tieng-anh': 'TA', 'gd-the-chap': 'GDTC', 'am-nhac': 'ÂN', 'mi-thuat': 'MT',
            'htn': 'HĐTN', 'diem-tb': 'TB'
        }[subjectKey] || subjectKey;
    }

    /**
     * Map toàn bộ 6 trường auto từ object điểm 1 HS.
     *
     * @param diemObj { 'tieng-viet': 9, 'toan': 10, ... }
     * @returns { nl_ngon_ngu: {...}, nl_tinh_toan: {...}, ... }
     */
    static scoresToGrades(diemObj) {
        if (!diemObj || typeof diemObj !== 'object') {
            throw new Error('scoresToGrades: diemObj phải là object');
        }
        const result = {};
        for (const [field, rule] of Object.entries(NLPC_FIELD_RULES)) {
            result[field] = {
                label: rule.label,
                ...this._mapOneField(rule, diemObj)
            };
        }
        return result;
    }

    /**
     * Convenience: đọc cache + map. Dùng cho UI Form NLPC.
     *
     * @returns Promise<{
     *   className, studentId, found:boolean,
     *   diem: {...}, suggestions: { nl_ngon_ngu: {...}, ... }
     * }>
     */
    static async autoSuggestForStudent(className, studentId) {
        const scores = await CacheManager.getStudentScores(className, studentId);
        if (!scores) {
            return {
                className,
                studentId,
                found: false,
                diem: {},
                suggestions: this.scoresToGrades({})
            };
        }
        return {
            className,
            studentId,
            found: true,
            diem: scores.diem,
            suggestions: this.scoresToGrades(scores.diem),
            lastSynced: scores.lastSynced
        };
    }

    /** List 13 field — cho UI render thứ tự, grouped theo section */
    static listAutoFields() {
        return Object.entries(NLPC_FIELD_RULES).map(([key, r]) => ({
            key,
            label: r.label,
            section: r.section
        }));
    }

    /** Group 13 field theo section (cho UI render 3 cụm) */
    static fieldsBySection() {
        const out = { nang_luc_chung: [], nang_luc_dac_thu: [], pham_chat: [] };
        for (const [key, r] of Object.entries(NLPC_FIELD_RULES)) {
            out[r.section].push({ key, label: r.label });
        }
        return out;
    }
}

NLPCMapper.NLPC_FIELD_RULES = NLPC_FIELD_RULES;

if (typeof window !== 'undefined') {
    window.NhanXetEngineV2 = NhanXetEngineV2;
    window.CacheManager = CacheManager;
    window.NLPCMapper = NLPCMapper;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NhanXetEngineV2, CacheManager, NLPCMapper };
}
