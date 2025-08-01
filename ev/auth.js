// ตัวอย่างข้อมูลผู้ใช้ (สำหรับ mockup)
// ในระบบจริงต้องเชื่อมฐานข้อมูลและระบบยืนยันตัวตนจริง
const users = [
  { username: 'admin', password: '123', role: 'admin' },
  { username: 'emp', password: '123', role: 'employee' },
  { username: 'user', password: '123', role: 'user' },
];

// ตรวจสอบล็อกอิน
function authenticate(username, password){
  return users.some(u => u.username === username && u.password === password);
}

// คืน role ของผู้ใช้
function getUserRole(username){
  const user = users.find(u => u.username === username);
  return user ? user.role : null;
}

// ตรวจสอบสถานะล็อกอิน และตรวจสอบสิทธิ์ role
function checkLogin(requiredRole){
  const loggedUser = localStorage.getItem('loggedUser');
  const userRole = localStorage.getItem('userRole');
  if(!loggedUser){
    alert('กรุณาเข้าสู่ระบบก่อนใช้งาน');
    window.location.href = 'login.html';
    return false;
  }
  if(requiredRole && userRole !== requiredRole){
    alert('ไม่มีสิทธิ์ใช้งานหน้่านี้');
    window.location.href = 'login.html';
    return false;
  }
  document.getElementById('loggedUser').innerText = loggedUser + ' (' + userRole + ')';
  return true;
}

// ออกจากระบบ
function logout(){
  localStorage.removeItem('loggedUser');
  localStorage.removeItem('userRole');
  window.location.href = 'login.html';
}
