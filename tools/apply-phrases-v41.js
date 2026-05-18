/**
 * Merge NEW_PHRASES_V41 vào:
 *   - engine/data/nhanxet-grade.json  → subjects[code].grades.all.all_ky[tier].default
 *   - engine/data/nhanxet-ngan.json   → subjects[code][tier]   (flat fallback)
 *
 * Append (không thay thế phrase cũ).  Dedupe theo trim() lowercased.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { NEW_PHRASES_V41 } = require('./new-phrases-v41.js');

const ROOT = path.resolve(__dirname, '..');
const GRADE_PATH = path.join(ROOT, 'engine', 'data', 'nhanxet-grade.json');
const NGAN_PATH = path.join(ROOT, 'engine', 'data', 'nhanxet-ngan.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJson(p, obj) { fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

function mergeInto(arr, newPhrases) {
    if (!Array.isArray(arr)) return [...newPhrases];
    const seen = new Set(arr.map(s => String(s).trim().toLowerCase()));
    const out = [...arr];
    for (const p of newPhrases) {
        const k = String(p).trim().toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(p);
    }
    return out;
}

function ensurePath(obj, ...keys) {
    let cur = obj;
    for (const k of keys) {
        if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
        cur = cur[k];
    }
    return cur;
}

const grade = readJson(GRADE_PATH);
const ngan = readJson(NGAN_PATH);

let addedGrade = 0, addedNgan = 0;

for (const [code, tiers] of Object.entries(NEW_PHRASES_V41)) {
    // GRADE — grades.all.all_ky[tier].default
    if (!grade.subjects[code]) {
        const nameFromNgan = ngan.subjects[code] && ngan.subjects[code].name;
        grade.subjects[code] = { name: nameFromNgan || code, grades: { all: { all_ky: {} } } };
    }
    const allKy = ensurePath(grade.subjects[code], 'grades', 'all', 'all_ky');
    for (const [tier, phrases] of Object.entries(tiers)) {
        if (!allKy[tier]) allKy[tier] = {};
        if (!Array.isArray(allKy[tier].default)) allKy[tier].default = [];
        const before = allKy[tier].default.length;
        allKy[tier].default = mergeInto(allKy[tier].default, phrases);
        addedGrade += (allKy[tier].default.length - before);
    }

    // NGAN — flat subjects[code][tier]
    if (!ngan.subjects[code]) {
        ngan.subjects[code] = { name: code };
    }
    for (const [tier, phrases] of Object.entries(tiers)) {
        const before = Array.isArray(ngan.subjects[code][tier]) ? ngan.subjects[code][tier].length : 0;
        ngan.subjects[code][tier] = mergeInto(ngan.subjects[code][tier], phrases);
        addedNgan += (ngan.subjects[code][tier].length - before);
    }
}

// Bump meta versions
if (grade.meta) {
    grade.meta.version = '4.1.0';
    grade.meta.source = (grade.meta.source || '') + ' | V4.1: +5 phrase/tier/môn theo spec V4.1 (TT27 + TT32) — câu hoàn chỉnh không cần suffix.';
}
if (ngan.meta) {
    ngan.meta.version = '4.1.0';
    ngan.meta.note = (ngan.meta.note || '') + ' | V4.1 (2026-05-18): bổ sung +5 phrase/tier/môn theo spec V4.1 — pool nền chuẩn, câu hoàn chỉnh.';
}

writeJson(GRADE_PATH, grade);
writeJson(NGAN_PATH, ngan);

console.log(`[V4.1] Đã merge ${addedGrade} phrase vào nhanxet-grade.json (grades.all.all_ky)`);
console.log(`[V4.1] Đã merge ${addedNgan} phrase vào nhanxet-ngan.json (flat)`);
