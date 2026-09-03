# Auth Testing (Grace Cares)

Admin: paul@cass-online.co.uk / GraceCares2026! (role super_admin)

Endpoints under /api/auth: register, login, logout, me, refresh, forgot-password, reset-password.
Cookies: httpOnly access_token (12h) + refresh_token (7d), secure, samesite=none.
Login lockout: 5 failed attempts per ip:email = 15 min.

Verify:
- curl -c cookies.txt -X POST $API/api/auth/login -d '{"email":"paul@cass-online.co.uk","password":"GraceCares2026!"}' -H 'Content-Type: application/json'
- curl -b cookies.txt $API/api/auth/me  -> returns user with role super_admin
- bcrypt hash starts with $2b$
