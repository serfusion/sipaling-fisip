import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { bacaKurikulumAcuan, gabungKonsentrasi, periksaBaris, barisKeAoa, OPSI_BAWAAN, type Aoa } from "./src/app/dashboard/template/kurikulum-parse";

const buf = readFileSync("/tmp/claude-0/-home-user-sipaling-fisip/72e71ca5-9f6b-5e19-8df7-076fecea9829/scratchpad/acuan.xlsx");
const wb = XLSX.read(buf, { type: "buffer" });
const ws = wb.Sheets[wb.SheetNames[0]];
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" }) as Aoa;

const baca = bacaKurikulumAcuan(aoa);
console.log("konsentrasi:", baca.konsentrasi);
console.log("semester ditemukan:", baca.semesterAda);
console.log("baris terbaca:", baca.baris.length, "| ditolak:", baca.tolak.length);
for (const t of baca.tolak.slice(0, 5)) console.log("   tolak:", t.baris, "-", t.alasan);

const gab = gabungKonsentrasi(baca.baris);
console.log("\nsesudah digabung:", gab.baris.length, "baris | ganda dibuang:", gab.ganda);
console.log("bentrok:", gab.bentrok.length);
for (const b of gab.bentrok) console.log("   ", b.kode, "->", b.versi.map((v) => `${v.nama} (${v.sks} sks, sem ${v.semester}, ${v.konsentrasi})`));

console.log("\nmasalah:", periksaBaris(gab.baris).length);
for (const m of periksaBaris(gab.baris).slice(0, 5)) console.log("   ", m.kode, m.nama, "->", m.sebab);

const per = new Map<number, number>();
for (const b of gab.baris) per.set(b.semester, (per.get(b.semester) ?? 0) + 1);
console.log("\nper semester:", [...per.entries()].sort((a,b)=>a[0]-b[0]).map(([s,n])=>`sem${s}:${n}`).join(" "));

const aoaOut = barisKeAoa(gab.baris, { ...OPSI_BAWAAN, tahunKurikulum: "20241", kodeProdi: "70201" });
console.log("\n3 baris keluaran (16 kolom):");
for (const r of aoaOut.slice(0, 3)) console.log("   ", JSON.stringify(r));
console.log("lebar tiap baris:", new Set(aoaOut.map((r) => r.length)));
