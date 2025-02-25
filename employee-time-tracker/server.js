////////////////////////////////////////////////////////////////////////////////
// server.js
////////////////////////////////////////////////////////////////////////////////
const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const path = require("path");

const app = express();
// **IMPORTANT: Double check database.db is in the same directory as server.js, or provide the correct path**
const db = new sqlite3.Database("./database.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to the SQLite database.");
    db.serialize(() => {
      // Create tables if they don't exist
      db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT,
          password TEXT,
          isAdmin INTEGER
        )`, function(err) { // Removed 'approved' from CREATE TABLE initially
          if (err) {
            return console.error("Error creating users table:", err.message);
          }
          // console.log("Users table created or already exists."); // Removed this line

          // **ADD THIS BLOCK TO ADD THE 'approved' COLUMN IF IT DOESN'T EXIST**
          db.run(`ALTER TABLE users ADD COLUMN approved INTEGER DEFAULT 0`, function(alterErr) {
            if (alterErr) {
              // If the column already exists, this will likely error (which is okay)
              // console.log("Column 'approved' already exists or error adding it:", alterErr.message); // Removed this line
            } else {
              console.log("Successfully added 'approved' column to users table.");
            }
          });
          // console.log("Users table structure checked and/or updated for 'approved' column."); // Removed this line
        });

      db.run(`CREATE TABLE IF NOT EXISTS time_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER,
          clockIn DATETIME,
          clockOut DATETIME
        )`, function(err) {
          if (err) {
            return console.error("Error creating time_logs table:", err.message);
          }
          // Removed console.log for time_logs table message
        });

      db.run(`CREATE TABLE IF NOT EXISTS news (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          content TEXT,
          published_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, function(err) {
          if (err) {
            return console.error("Error creating news table:", err.message);
          }
          // Removed console.log for news table message
        });
    });
  }
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "secretKey", // Change this to a strong, random secret in production
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Passport Local Strategy
passport.use(
  new LocalStrategy((username, password, done) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
      if (err) {
        console.error("Passport LocalStrategy - DB error:", err);
        return done(err);
      }
      if (!row) {
        // Username not found
        return done(null, false, { message: "Incorrect username." });
      }

      // Compare hashed password
      bcrypt.compare(password, row.password, (err, result) => {
        if (err) {
          console.error("Passport LocalStrategy - bcrypt compare error:", err);
          return done(err);
        }
        if (result) {
          return done(null, row);
        } else {
          return done(null, false, { message: "Incorrect password." });
        }
      });
    });
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
    if (err) {
      console.error("Passport deserializeUser - DB error:", err);
      return done(err);
    }
    done(null, row);
  });
});

// Helper Middlewares
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.redirect("/login.html");
}

function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.isAdmin) return next();
  res.status(403).send("Access Denied");
}

// Landing Page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// -------------------------------------
// Registration (POST /register)
// -------------------------------------
app.post("/register", async (req, res) => {
  try {
    const { username, password, confirmPassword } = req.body;
    if (!username || !password || !confirmPassword) {
      return res.redirect("/register.html?error=missing");
    }

    if (password !== confirmPassword) {
      return res.redirect("/register.html?error=mismatch");
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
      if (err) {
        console.error("Register - username check DB error:", err);
        return res.redirect("/register.html?error=db");
      }
      if (row) {
        return res.redirect("/register.html?error=taken");
      }

      // Hash the password
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
          console.error("Register - bcrypt hash error:", err);
          return res.redirect("/register.html?error=hash");
        }

        // Insert new user with approved=0 (needs admin approval) - Re-added approved column
        db.run(
          "INSERT INTO users (username, password, isAdmin, approved) VALUES (?, ?, 0, 0)", // Re-added approved
          [username, hash],
          function (err2) {
            if (err2) {
              console.error("Register - user insert DB error:", err2);
              return res.redirect("/register.html?error=insert");
            }
            // Indicate success but user needs approval
            res.redirect("/login.html?registered=1&needsApproval=1"); // Added '&needsApproval=1'
          }
        );
      });
    });
  } catch (err) {
    console.error("Register - unknown error:", err);
    res.redirect("/register.html?error=unknown");
  }
});

// -------------------------------------
// Login (POST /login)
// -------------------------------------
app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user) => {
    if (err) {
      console.error("Login - passport authenticate error:", err);
      return next(err);
    }
    if (!user) {
      // Invalid credentials
      return res.redirect("/login.html?error=invalid");
    }

    // Check if the user is approved - Re-added approval check
    if (user.approved === 0) {
      // Not yet approved by admin
      return res.redirect("/login.html?error=notApproved"); // Redirect with error if not approved
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error("Login - req.logIn error:", err);
        return next(err);
      }
      // Admin redirect => /admin.html, else => /dashboard.html
      if (user.isAdmin) {
        return res.redirect("/admin.html");
      } else {
        return res.redirect("/dashboard.html");
      }
    });
  })(req, res, next);
});

// Logout
app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) {
      console.error("Logout error:", err);
      return next(err);
    }
    res.redirect("/login.html");
  });
});

// Clock In
app.post("/clock-in", isAuthenticated, (req, res) => {
  const userId = req.user.id;
  const now = new Date().toISOString();
  db.run(
    "INSERT INTO time_logs (userId, clockIn) VALUES (?, ?)",
    [userId, now],
    function (err) {
      if (err) {
        console.error("Clock-in DB error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, logId: this.lastID });
    }
  );
});

// Clock Out
app.post("/clock-out", isAuthenticated, (req, res) => {
  const userId = req.user.id;
  const now = new Date().toISOString();
  db.get(
    "SELECT id FROM time_logs WHERE userId = ? AND clockOut IS NULL ORDER BY clockIn DESC LIMIT 1",
    [userId],
    (err, row) => {
      if (err) {
        console.error("Clock-out - get active log DB error:", err);
        return res.status(500).json({ error: err.message });
      }
      if (!row) {
        return res.status(400).json({ error: "No active clock-in found" });
      }
      db.run(
        "UPDATE time_logs SET clockOut = ? WHERE id = ?",
        [now, row.id],
        function (err) {
          if (err) {
            console.error("Clock-out - update log DB error:", err);
            return res.status(500).json({ error: err.message });
          }
          res.json({ success: true });
        }
      );
    }
  );
});

// Admin: View Logs
app.get("/api/logs", isAdmin, (req, res) => {
  const sql = `
    SELECT
      time_logs.id AS logId,
      users.username AS username,
      time_logs.clockIn,
      time_logs.clockOut
    FROM time_logs
    JOIN users ON time_logs.userId = users.id
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error("/api/logs - DB error:", err);
      return res.status(500).json({ error: err.message });
    }
    const logs = rows.map((row) => ({
      id: row.logId,
      username: row.username,
      clockIn: row.clockIn,
      clockOut: row.clockOut,
    }));
    res.json({ logs });
  });
});

// Reset logs
app.get("/reset-logs", isAdmin, (req, res) => {
  db.run("DELETE FROM time_logs", (err) => {
    if (err) {
      console.error("/reset-logs - DELETE time_logs DB error:", err);
      return res.status(500).json({ error: err.message });
    }
    db.run("DELETE FROM sqlite_sequence WHERE name='time_logs'", (err2) => {
      if (err2) {
        console.error("/reset-logs - DELETE sqlite_sequence DB error:", err2);
        return res.status(500).json({ error: err2.message });
      }
      res.json({
        success: true,
        message: "All logs have been cleared. Next log ID will be 1.",
      });
    });
  });
});

// Admin: Publish news
app.post("/publish-news", isAdmin, (req, res) => {
  const { title, content } = req.body;
  const published_date = new Date().toISOString();
  db.run(
    "INSERT INTO news (title, content, published_date) VALUES (?, ?, ?)",
    [title, content, published_date],
    function (err) {
      if (err) {
        console.error("/publish-news - DB error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, newsId: this.lastID });
    }
  );
});

// GET news
app.get("/api/news", isAuthenticated, (req, res) => {
  db.all("SELECT * FROM news ORDER BY published_date DESC", [], (err, rows) => {
    if (err) {
      console.error("/api/news - DB error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ news: rows });
  });
});

// GET specific news item for editing - NEW ENDPOINT
app.get("/api/news/:newsId", isAdmin, (req, res) => {  // Admin only for editing
  const newsId = req.params.newsId;
  db.get("SELECT * FROM news WHERE id = ?", [newsId], (err, row) => {
    if (err) {
      console.error("/api/news/:newsId - GET news item DB error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    if (!row) {
      return res.status(404).json({ success: false, error: "News item not found" });
    }
    res.json({ success: true, newsItem: row }); // Send back the news item data
  });
});

// UPDATE news item - NEW ENDPOINT
app.put("/api/news/:newsId", isAdmin, (req, res) => { // Admin only for editing
  const newsId = req.params.newsId;
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ success: false, error: "Title and content are required" });
  }
  db.run(
    "UPDATE news SET title = ?, content = ? WHERE id = ?",
    [title, content, newsId],
    function (err) {
      if (err) {
        console.error("/api/news/:newsId - UPDATE news DB error:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: "News item not found" });
      }
      res.json({ success: true });
    }
  );
});


// DELETE news
app.delete("/api/news/:newsId", isAdmin, (req, res) => {
  const newsId = req.params.newsId;
  db.run("DELETE FROM news WHERE id = ?", [newsId], function (err) {
    if (err) {
      console.error("/api/news/:newsId - DELETE news DB error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: "News item not found" });
    }
    res.json({ success: true });
  });
});

// GET all users (Admin Only)
app.get("/api/users", isAdmin, (req, res) => {
  db.all("SELECT id, username, isAdmin, approved FROM users", [], (err, rows) => { // Re-added 'approved' in SELECT
    if (err) {
      console.error("/api/users - DB error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json({ users: rows });
  });
});

// DELETE a user (Admin Only)
app.delete("/api/users/:userId", isAdmin, (req, res) => {
  const userId = req.params.userId;
  // Prevent admin from deleting themselves
  if (req.user.id == userId) {
    return res.status(403).json({ success: false, error: "Cannot delete yourself." });
  }

  db.run("DELETE FROM users WHERE id = ?", [userId], function (err) {
    if (err) {
      console.error("/api/users/:userId - DELETE user DB error:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ success: false, error: "User not found" });
    }
    res.json({ success: true });
  });
});

// Grant Admin Role (Admin Only)
app.put("/api/users/:userId/grant-admin", isAdmin, (req, res) => {
  const userId = req.params.userId;
  // Prevent admin from granting admin role to themselves (though UI will prevent this too)
  if (req.user.id == userId) {
    return res.status(400).json({ success: false, error: "Cannot grant admin role to yourself." });
  }
  db.run(
    "UPDATE users SET isAdmin = 1 WHERE id = ?",
    [userId],
    function (err) {
      if (err) {
        console.error("/api/users/:userId/grant-admin - UPDATE user DB error:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      res.json({ success: true });
    }
  );
});

// Revoke Admin Role (Admin Only)
app.put("/api/users/:userId/revoke-admin", isAdmin, (req, res) => {
  const userId = req.params.userId;
  // Prevent admin from revoking admin role from themselves (though UI will prevent this too)
  if (req.user.id == userId) {
    return res.status(400).json({ success: false, error: "Cannot revoke admin role from yourself." });
  }
  db.run(
    "UPDATE users SET isAdmin = 0 WHERE id = ?",
    [userId],
    function (err) {
      if (err) {
        console.error("/api/users/:userId/revoke-admin - UPDATE user DB error:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      res.json({ success: true });
    }
  );
});

// Approve a user (Admin Only) - New endpoint
app.put("/api/users/:userId/approve", isAdmin, (req, res) => {
  const userId = req.params.userId;
  db.run(
    "UPDATE users SET approved = 1 WHERE id = ?",
    [userId],
    function (err) {
      if (err) {
        console.error("/api/users/:userId/approve - UPDATE user DB error:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      res.json({ success: true });
    }
  );
});

// Reject a user (Admin Only) - New endpoint
app.delete("/api/users/:userId/reject", isAdmin, (req, res) => {
  const userId = req.params.userId;
  // For rejection, we will delete the user for simplicity. You could also just set `approved = -1` if you want to keep records of rejected users.
  db.run(
    "DELETE FROM users WHERE id = ?",
    [userId],
    function (err) {
      if (err) {
        console.error("/api/users/:userId/reject - DELETE user DB error:", err);
        return res.status(500).json({ success: false, error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ success: false, error: "User not found" });
      }
      res.json({ success: true });
    }
  );
});


// GET current user data (Admin or regular user - Authenticated)
app.get("/api/current-user", isAuthenticated, (req, res) => {
  res.json({ user: req.user }); // Send back the user object from passport
});

// -------------------------------------
// Change Password (PUT /api/user/password) - NEW ENDPOINT - ADDED HERE
// -------------------------------------
app.put("/api/user/password", isAuthenticated, async (req, res) => { // Requires authentication
  const userId = req.user.id; // Get user ID from authenticated session
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, error: "All password fields are required." });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, error: "New passwords do not match." });
  }

  if (newPassword.length < 6) { // Example password length validation
    return res.status(400).json({ success: false, error: "New password must be at least 6 characters long." });
  }


  db.get("SELECT password FROM users WHERE id = ?", [userId], (err, row) => {
    if (err) {
      console.error("/api/user/password - DB error (select current password):", err);
      return res.status(500).json({ success: false, error: "Database error." });
    }
    if (!row) {
      return res.status(404).json({ success: false, error: "User not found." }); // Should not happen if authenticated
    }

    bcrypt.compare(currentPassword, row.password, async (bcryptErr, isMatch) => {
      if (bcryptErr) {
        console.error("/api/user/password - bcrypt compare error:", bcryptErr);
        return res.status(500).json({ success: false, error: "Error verifying current password." });
      }

      if (!isMatch) {
        return res.status(401).json({ success: false, error: "Incorrect current password." }); // 401 for unauthorized
      }

      // Hash the new password
      try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        db.run(
          "UPDATE users SET password = ? WHERE id = ?",
          [hashedPassword, userId],
          function (updateErr) {
            if (updateErr) {
              console.error("/api/user/password - DB error (update password):", updateErr);
              return res.status(500).json({ success: false, error: "Failed to update password in database." });
            }
            res.json({ success: true, message: "Password changed successfully!" });
          }
        );
      } catch (hashError) {
        console.error("/api/user/password - bcrypt hash error:", hashError);
        return res.status(500).json({ success: false, error: "Error hashing new password." });
      }
    });
  });
});


// Start server
app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});