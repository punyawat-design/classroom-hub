# อัปเกรดจากเว็บเดิมเป็น v6

ทำแค่ 3 ขั้น:

1. Supabase → SQL Editor → Run:
   `supabase/migration_v6.sql`

2. นำไฟล์ v6 ไปแทนโปรเจกต์ GitHub เดิม
   **อย่าอัปโหลด `.env`**

3. Commit + Push

Vercel จะ Deploy อัตโนมัติ

ถ้า Build สำเร็จ ให้ Hard Refresh หน้าเว็บ:
`Ctrl + F5`
