import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AppointmentsService {
  constructor(private readonly database: DatabaseService) {}

  // User sets their available time slots
  async createAvailability(userId: number, date: string, startTime: string, endTime: string) {
    return this.database.queryOne(
      `INSERT INTO user_availability_slots (user_id, available_date, start_time, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, date, startTime, endTime],
    );
  }

  // Fetch available slots for a specific date
  async getAvailableSlots(date: string) {
    return this.database.query(
      `SELECT slot_id, user_id, available_date, start_time, end_time 
       FROM user_availability_slots 
       WHERE available_date = $1 AND is_booked = FALSE
       ORDER BY start_time ASC`,
      [date],
    );
  }

  // Book an appointment (Transactional logic)
  async bookAppointment(customerId: number, slotId: number, purpose: string) {
    // Transactional simulation - in a real implementation, utilize a PG transaction block
    const slot = await this.database.queryOne(
      `SELECT is_booked FROM user_availability_slots WHERE slot_id = $1`,
      [slotId]
    );

    if (!slot || slot.is_booked) {
      throw new ConflictException('This time slot is no longer available.');
    }

    // Lock the slot
    await this.database.query(
      `UPDATE user_availability_slots SET is_booked = TRUE WHERE slot_id = $1`,
      [slotId]
    );

    // Create the appointment
    return this.database.queryOne(
      `INSERT INTO appointments (customer_id, slot_id, purpose)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [customerId, slotId, purpose],
    );
  }
}