const authService = require("../services/authService");
const userRepository = require("../repositories/userRepository");
const { assertValidUsername } = require("../validators/usernameValidator");

module.exports = {
  register: async (req, res, next) => {
    try {
      res.json(await authService.register(req.body));
    } catch (error) {
      next(error);
    }
  },

  login: async (req, res, next) => {
    try {
      res.json(await authService.login(req.body));
    } catch (error) {
      next(error);
    }
  },

  checkUsername: async (req, res, next) => {
    try {
      const username = assertValidUsername(req.params.username);
      res.json({ available: !(await userRepository.findByUsername(username)) });
    } catch (error) {
      next(error);
    }
  },

  updateUsername: async (req, res, next) => {
    try {
      res.json(await authService.updateUsername(req.user.username, req.body.username));
    } catch (error) {
      next(error);
    }
  },

  updateProfileImage: async (req, res, next) => {
    try {
      res.json(await authService.updateProfileImage(req.user.username, req.body.profileImage));
    } catch (error) {
      next(error);
    }
  },

  forgotPassword: async (req, res, next) => {
    try {
      const result = await authService.forgotPassword({ email: req.body.email, req });
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  resetPasswordPage: async (req, res, next) => {
    try {
      const { token } = req.query;
      if (!token) return res.status(400).send("<h1>Error: Missing reset token</h1>");
      
      const { verifyJwt } = require("../utils/jwt");
      try {
        verifyJwt(token);
      } catch (err) {
        return res.status(400).send(`
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #FEF7FF; color: #1C1B1F; margin: 0; }
                .card { background: #F7F2FA; padding: 32px; border-radius: 24px; text-align: center; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                h1 { color: #B3261E; margin-bottom: 12px; font-size: 24px; font-weight: 800; }
                p { color: #49454F; font-size: 15px; line-height: 22px; }
              </style>
            </head>
            <body>
              <div class="card">
                <h1>Link Expired or Invalid</h1>
                <p>This password reset link is invalid or has expired. Please request a new link from the GreenMoney app.</p>
              </div>
            </body>
          </html>
        `);
      }

      res.send(`
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Password - GreenMoney</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #FEF7FF; color: #1C1B1F; margin: 0; }
              .card { background: #F7F2FA; padding: 40px; border-radius: 24px; width: 100%; max-width: 400px; box-shadow: 0 4px 16px rgba(0,0,0,0.05); box-sizing: border-box; }
              .logo { color: #2E7D32; font-size: 32px; font-weight: 900; text-align: center; margin-bottom: 24px; display: flex; align-items: center; justify-content: center; gap: 8px; }
              h2 { font-size: 20px; font-weight: 700; margin-bottom: 8px; color: #1C1B1F; text-align: center; }
              .subtitle { font-size: 14px; color: #49454F; text-align: center; margin-bottom: 24px; line-height: 20px; }
              .form-group { margin-bottom: 16px; }
              label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #1C1B1F; }
              input { width: 100%; padding: 12px 16px; border: 1px solid #CAC4D0; border-radius: 12px; font-size: 15px; outline: none; box-sizing: border-box; background: white; transition: border-color 0.2s; }
              input:focus { border-color: #2E7D32; }
              .btn { background: #2E7D32; color: white; border: none; width: 100%; padding: 14px; font-size: 16px; font-weight: 700; border-radius: 24px; cursor: pointer; margin-top: 12px; transition: opacity 0.2s; }
              .btn:hover { opacity: 0.9; }
              .error-msg { color: #B3261E; font-size: 13px; margin-top: 6px; display: none; text-align: center; font-weight: 600; }
            </style>
            <script>
              function validateForm(e) {
                const pass = document.getElementById('pass').value;
                const confirm = document.getElementById('confirm').value;
                const err = document.getElementById('err');
                
                if (pass.length < 6) {
                  e.preventDefault();
                  err.innerText = "Password must be at least 6 characters.";
                  err.style.display = 'block';
                  return false;
                }
                
                if (pass !== confirm) {
                  e.preventDefault();
                  err.innerText = "Passwords do not match.";
                  err.style.display = 'block';
                  return false;
                }
                return true;
              }
            </script>
          </head>
          <body>
            <div class="card">
              <div class="logo">🌿 GreenMoney</div>
              <h2>Reset Password</h2>
              <div class="subtitle">Enter your new password below.</div>
              <form action="/auth/reset-password" method="POST" onsubmit="return validateForm(event)">
                <input type="hidden" name="token" value="${token}" />
                <div class="form-group">
                  <label for="pass">New Password</label>
                  <input type="password" id="pass" name="password" required placeholder="At least 6 characters" />
                </div>
                <div class="form-group">
                  <label for="confirm">Confirm Password</label>
                  <input type="password" id="confirm" required placeholder="Re-enter your password" />
                </div>
                <div id="err" class="error-msg"></div>
                <button type="submit" class="btn">Update Password</button>
              </form>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      next(error);
    }
  },

  resetPassword: async (req, res, next) => {
    try {
      await authService.resetPassword(req.body);
      res.send(`
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #FEF7FF; color: #1C1B1F; margin: 0; }
              .card { background: #F7F2FA; padding: 40px; border-radius: 24px; text-align: center; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
              .icon { color: #2E7D32; font-size: 64px; margin-bottom: 16px; }
              h1 { color: #2E7D32; margin-bottom: 12px; font-size: 24px; font-weight: 800; }
              p { color: #49454F; font-size: 15px; line-height: 22px; margin-bottom: 24px; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon">✓</div>
              <h1>Password Updated</h1>
              <p>Your password has been reset successfully. You can now close this browser window and log in with your new password in the GreenMoney app.</p>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      res.status(400).send(`
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #FEF7FF; color: #1C1B1F; margin: 0; }
              .card { background: #F7F2FA; padding: 40px; border-radius: 24px; text-align: center; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
              h1 { color: #B3261E; margin-bottom: 12px; font-size: 24px; font-weight: 800; }
              p { color: #49454F; font-size: 15px; line-height: 22px; }
            </style>
          </head>
          <body>
            <div class="card">
              <h1>Reset Failed</h1>
              <p>${error.message || "Failed to update your password. Please try requesting a new reset link."}</p>
            </div>
          </body>
        </html>
      `);
    }
  },
};
