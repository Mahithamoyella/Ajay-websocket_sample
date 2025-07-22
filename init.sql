
-- Create the table
CREATE TABLE IF NOT EXISTS sampledata_table (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL
);

-- Insert sample data
INSERT INTO sampledata_table (email, password, name, role)
VALUES
  ('ajay@example.com', '1234', 'Ajay', 'Employee'),
  ('john@example.com', 'abcd', 'John', 'HR')
ON CONFLICT (email) DO NOTHING;
