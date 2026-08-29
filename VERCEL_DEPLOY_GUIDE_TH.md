# คู่มือ Deploy Classroom Hub ไป Vercel

เวอร์ชันนี้ใช้:

- **Vercel** = รันหน้าเว็บ React + Vite
- **Supabase Auth** = Login
- **Supabase PostgreSQL** = ฐานข้อมูล
- **Supabase Storage** = เก็บไฟล์งานและสื่อ
- **Supabase RLS** = จำกัดสิทธิ์ครู/นักเรียน

ฐานข้อมูล Supabase เดิมใช้ต่อได้ ไม่ต้องสร้างใหม่ถ้าเคยรัน `supabase/schema.sql` แล้ว

---

## วิธีที่แนะนำ: GitHub + Vercel

### 1. Push โปรเจกต์ขึ้น GitHub

สร้าง Repository แล้วอัปโหลดโฟลเดอร์นี้ขึ้น GitHub

### 2. เข้า Vercel

- Login Vercel
- Add New → Project
- Import Git Repository
- เลือก Repository ของ Classroom Hub

### 3. ตั้งค่า Build

Vercel มักตรวจ Vite ได้อัตโนมัติ แต่ให้ตรวจว่าเป็น:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 4. เพิ่ม Environment Variables

ใน Vercel Project → Settings → Environment Variables

เพิ่ม:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

ค่าเหมือนกับไฟล์ `.env`

> ใช้เฉพาะ Supabase Anon/Public Key
> ห้ามใส่ Service Role Key ในเว็บ Frontend

### 5. Deploy

กด Deploy

เมื่อเสร็จจะได้ URL ลักษณะ:

```text
https://ชื่อโปรเจกต์.vercel.app
```

---

# Deploy จากเครื่องโดยตรง

ติดตั้ง:

```bash
npm install
```

Login Vercel:

```bash
npx vercel login
```

Deploy Preview:

```bash
npx vercel
```

Deploy Production:

```bash
npm run deploy
```

ครั้งแรก Vercel จะถาม:
- Set up and deploy? → Y
- Which scope? → เลือกบัญชี
- Link to existing project? → N ถ้ายังไม่มี
- Project name → classroom-hub
- Directory → ./
- Override settings? → N

---

# React Router

ไฟล์ `vercel.json` ถูกเตรียมไว้แล้ว:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

จึงเปิด URL เช่น:

```text
/student/assignments/123
/teacher/tracking
/teacher/matrix
```

หรือ Refresh หน้าโดยตรงได้โดยไม่เจอ 404

---

# Supabase

ถ้ายังไม่ได้สร้างฐานข้อมูล:

1. Supabase → SQL Editor
2. เปิด `supabase/schema.sql`
3. Run

ตั้งบัญชีผู้ใช้ใน:

Authentication → Users

และเพิ่มข้อมูลลง `profiles`

ตัวอย่างครู:

```sql
insert into public.profiles(id,full_name,role)
values ('AUTH_USER_UUID','ครูสมชาย','teacher');
```

ตัวอย่างนักเรียน:

```sql
insert into public.profiles(id,full_name,role,student_code)
values ('AUTH_USER_UUID','สมหญิง ใจดี','student','65001');
```

---

# เวลาแก้เว็บในอนาคต

ถ้าเชื่อม GitHub:

```text
แก้โค้ด → Commit → Push
```

Vercel จะ Build และ Deploy เวอร์ชันใหม่ให้อัตโนมัติ

ถ้า Deploy จากเครื่อง:

```bash
npm run deploy
```

---

# Custom Domain

ภายหลังสามารถไปที่:

Vercel Project → Settings → Domains

แล้วเพิ่มโดเมน เช่น:

```text
classroom.school.ac.th
```

ได้
