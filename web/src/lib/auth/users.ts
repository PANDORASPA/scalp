export type StaffUser = {
  username: string
  password: string
  name: string
  role: 'admin' | 'staff'
}

export const STAFF_USERS: StaffUser[] = [
  {
    username: 'admin',
    password: 'admin123',
    name: 'Salon Admin',
    role: 'admin',
  },
  {
    username: 'staff',
    password: 'staff123',
    name: 'Front Desk',
    role: 'staff',
  },
]
