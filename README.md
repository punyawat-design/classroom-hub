# Classroom Hub — Vercel + Supabase

เวอร์ชันนี้เปลี่ยน Hosting จาก Cloudflare Pages มาเป็น **Vercel**

## โครงสร้าง

- Vercel → React + Vite Frontend
- Supabase Auth → Login
- Supabase PostgreSQL → Database
- Supabase Storage → Files
- Supabase RLS → Permissions

## สิ่งที่แก้จาก Cloudflare

- ลบ Wrangler
- ลบ Cloudflare deployment config
- เพิ่ม Vercel CLI
- เพิ่ม `vercel.json` สำหรับ React Router SPA
- เพิ่ม `VERCEL_DEPLOY_GUIDE_TH.md`

## ทดลองบนเครื่อง

```bash
npm install
npm run dev
```

## Deploy

วิธีแนะนำ:
GitHub → Import Project ใน Vercel → เพิ่ม Environment Variables → Deploy

หรือใช้ CLI:

```bash
npx vercel login
npm run deploy
```

อ่านขั้นตอนเต็มใน `VERCEL_DEPLOY_GUIDE_TH.md`
