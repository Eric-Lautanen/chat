import { DatabaseClient, Room } from '../types';

export class RoomModel {
  constructor(private db: DatabaseClient) {}

  async create(room: Room) {
    await this.db.run(
      'INSERT INTO rooms (id, name, creatorId, isPublic, createdAt) VALUES (?, ?, ?, ?, ?)',
      [room.id, room.name, room.creatorId, room.isPublic ? 1 : 0, room.createdAt]
    );
  }

  async getById(id: string): Promise<Room | undefined> {
    return this.db.get<Room>('SELECT * FROM rooms WHERE id = ?', [id]);
  }

  async getAllPublic(): Promise<Room[]> {
    return this.db.all<Room>('SELECT * FROM rooms WHERE isPublic = 1', []);
  }

  async delete(id: string) {
    await this.db.run('DELETE FROM rooms WHERE id = ?', [id]);
  }

  async updateTalkTime(id: string, talkTimeLimit: number) { // Added
    await this.db.run('UPDATE rooms SET talkTimeLimit = ? WHERE id = ?', [talkTimeLimit, id]);
  }
}