// src/modules/staff/staff.model.js
const pool = require('../../config/db');
const { hashPassword, comparePassword } = require('../../utils/passwordUtils');

class StaffModel {
  // Create staff member (Super Admin only)
  static async create(staffData, createdBy) {
    const {
      email,
      password,
      full_name,
      role_id,
      is_super_admin = false
    } = staffData;

    // Hash password
    const hashedPassword = await hashPassword(password);

    // First create user record
    const userQuery = `
      INSERT INTO users (email, username, full_name, is_active)
      VALUES ($1, $2, $3, true)
      RETURNING id
    `;
    
    const username = email.split('@')[0] + '_staff';
    const userResult = await pool.query(userQuery, [email, username, full_name]);
    const userId = userResult.rows[0].id;

    // Create staff record
    const staffQuery = `
      INSERT INTO staff (user_id, role_id, email, password_hash, is_super_admin, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [userId, role_id, email, hashedPassword, is_super_admin, createdBy];
    const staffResult = await pool.query(staffQuery, values);
    
    return staffResult.rows[0];
  }

  // Find staff by email
  static async findByEmail(email) {
    const query = `
      SELECT s.*, u.full_name, u.avatar_url, r.name as role_name, r.permissions
      FROM staff s
      JOIN users u ON s.user_id = u.id
      JOIN roles r ON s.role_id = r.id
      WHERE s.email = $1 AND s.is_active = true
    `;
    
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  // Find staff by ID
  static async findById(id) {
    const query = `
      SELECT s.*, u.full_name, u.avatar_url, r.name as role_name, r.permissions
      FROM staff s
      JOIN users u ON s.user_id = u.id
      JOIN roles r ON s.role_id = r.id
      WHERE s.id = $1
    `;
    
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  // Validate staff password
  static async validatePassword(staff, password) {
    return comparePassword(password, staff.password_hash);
  }

  // Update last login
  static async updateLastLogin(id) {
    const query = `
      UPDATE staff 
      SET last_login = CURRENT_TIMESTAMP, login_attempts = 0
      WHERE id = $1
    `;
    await pool.query(query, [id]);
  }

  // Increment login attempts
  static async incrementLoginAttempts(email) {
    const query = `
      UPDATE staff 
      SET login_attempts = login_attempts + 1,
          locked_until = CASE 
            WHEN login_attempts + 1 >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '30 minutes'
            ELSE locked_until
          END
      WHERE email = $1
      RETURNING locked_until
    `;
    
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  // Reset login attempts
  static async resetLoginAttempts(email) {
    const query = `
      UPDATE staff 
      SET login_attempts = 0, locked_until = NULL
      WHERE email = $1
    `;
    await pool.query(query, [email]);
  }

  // Check if account is locked
  static async isLocked(email) {
    const query = `
      SELECT locked_until 
      FROM staff 
      WHERE email = $1 AND locked_until > CURRENT_TIMESTAMP
    `;
    
    const result = await pool.query(query, [email]);
    return result.rows.length > 0;
  }

  // Get all staff members
  static async getAll(limit = 50, offset = 0) {
    const query = `
      SELECT s.id, s.email, s.is_super_admin, s.is_active, s.last_login, s.created_at,
             u.full_name, u.avatar_url, r.name as role_name
      FROM staff s
      JOIN users u ON s.user_id = u.id
      JOIN roles r ON s.role_id = r.id
      ORDER BY s.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    return result.rows;
  }

  // Update staff role
  static async updateRole(staffId, roleId, updatedBy) {
    const query = `
      UPDATE staff 
      SET role_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;
    
    const result = await pool.query(query, [roleId, staffId]);
    
    // Log the action
    await pool.query(
      `INSERT INTO admin_logs (staff_id, action, entity_type, entity_id, new_data)
       VALUES ($1, 'UPDATE_ROLE', 'staff', $2, $3)`,
      [updatedBy, staffId, JSON.stringify({ role_id: roleId })]
    );
    
    return result.rows[0];
  }

  // Deactivate staff
  static async deactivate(staffId, deactivatedBy) {
    const query = `
      UPDATE staff 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await pool.query(query, [staffId]);
    
    // Log the action
    await pool.query(
      `INSERT INTO admin_logs (staff_id, action, entity_type, entity_id)
       VALUES ($1, 'DEACTIVATE_STAFF', 'staff', $2)`,
      [deactivatedBy, staffId]
    );
    
    return result.rows[0];
  }
}

module.exports = StaffModel;