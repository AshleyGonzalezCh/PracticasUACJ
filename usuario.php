<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inicio de Sesión / Registro</title>
  <link href="https://fonts.googleapis.com/css2?family=Roboto&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      font-family: 'Roboto', sans-serif;
    }
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: #f0f0f0;
    }
    .container {
      width: 350px;
      overflow: hidden;
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
    }
    .tabs {
      display: flex;
      cursor: pointer;
    }
    .tab {
      width: 50%;
      text-align: center;
      padding: 10px;
      background: #eee;
      font-weight: bold;
      transition: background 0.3s ease;
    }
    .tab.active {
      background: #fff;
    }
    .form-wrapper {
      display: flex;
      width: 700px;
      transition: transform 0.5s ease;
    }
    form {
      width: 350px;
      padding: 20px;
    }
    input {
      width: 100%;
      margin: 10px 0;
      padding: 10px;
      border: 1px solid #ccc;
      border-radius: 6px;
    }
    button {
      width: 100%;
      padding: 10px;
      background: #4285f4;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
  </style>
</head>
<body>
<div class="container">
  <div class="tabs">
    <div class="tab active" onclick="showForm(0)">Iniciar Sesión</div>
    <div class="tab" onclick="showForm(1)">Registrarse</div>
  </div>
  <div class="form-wrapper" id="formWrapper">
    <form action="ConexionBD/login.php" method="POST">
      <h3>Iniciar Sesión</h3>
      <input type="email" name="correo" placeholder="Correo" required>
      <input type="password" name="contraseña" placeholder="Contraseña" required>
      <button type="submit">Entrar</button>
    </form>

    <form action="ConexionBD/register.php" method="POST">
      <h3>Registrarse</h3>
      <input type="text" name="nombre" placeholder="Nombre" required>
      <input type="text" name="apellido" placeholder="Apellido" required>
      <input type="email" name="correo" placeholder="Correo" required>
      <input type="password" name="contraseña" placeholder="Contraseña" required>
      <button type="submit">Registrar</button>
    </form>
  </div>
</div>

<script>
  function showForm(index) {
    const wrapper = document.getElementById('formWrapper');
    const tabs = document.querySelectorAll('.tab');
    wrapper.style.transform = `translateX(-${index * 350}px)`;
    tabs.forEach(tab => tab.classList.remove('active'));
    tabs[index].classList.add('active');
  }
</script>
</body>
</html>
