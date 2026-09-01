# วิธีอัปเกรด v6 → v7 แบบสั้น

## 1. Supabase
SQL Editor → New query → เปิดไฟล์:

`supabase/migration_v7.sql`

Copy ทั้งหมด → Run

ต้องขึ้น Success

## 2. GitHub
เอาไฟล์ใน `classroom-hub-vercel-v7` ไปแทนไฟล์เดิม

อย่าอัปโหลด:
`.env`

Commit changes

## 3. Vercel
รอ Deploy ใหม่ให้ขึ้น Ready

## 4. Browser
กด:
`Ctrl + F5`

จากนั้นเมนู “รายวิชา” จะมีระบบจัดนักเรียนเข้าวิชา/ถอนออก
และเมนู “งาน” จะมีปุ่มแก้ไข/ลบ
