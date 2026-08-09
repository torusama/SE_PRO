import { Injectable } from '@nestjs/common';
import { Namespace } from 'socket.io';
import { DatabaseService } from '../../database/database.service';
import {
  RealtimeRoom,
  RealtimeTopic,
  RealtimeUpdate,
} from './realtime.types';

const PUBLIC_TOPICS = new Set<RealtimeTopic>(['plots']);

@Injectable()
export class RealtimeService {
  private namespace?: Namespace;

  constructor(private readonly database: DatabaseService) {}

  attachNamespace(namespace: Namespace) {
    this.namespace = namespace;
  }

  publish(
    topics: readonly RealtimeTopic[],
    rooms: readonly RealtimeRoom[] = ['authenticated'],
  ) {
    if (!this.namespace) return;
    try {
      const uniqueTopics = [...new Set(topics)];
      const publicTopics = uniqueTopics.filter((topic) =>
        PUBLIC_TOPICS.has(topic),
      );
      const protectedTopics = uniqueTopics.filter(
        (topic) => !PUBLIC_TOPICS.has(topic),
      );
      const occurredAt = new Date().toISOString();

      if (publicTopics.length > 0) {
        this.emitToRooms(['public'], { topics: publicTopics, occurredAt });
      }
      if (protectedTopics.length > 0 && rooms.length > 0) {
        this.emitToRooms(rooms, { topics: protectedTopics, occurredAt });
      }
    } catch {
      // Realtime delivery is best-effort. It must never turn an already
      // committed business mutation into an HTTP error.
    }
  }

  publishToUser(userId: number, topics: readonly RealtimeTopic[]) {
    this.publish(topics, [`user:${userId}`]);
  }

  /** Disconnect sockets whose account or durable JWT session was revoked. */
  async disconnectInvalidUserSockets(userId: number) {
    try {
      if (!this.namespace || !Number.isInteger(userId) || userId <= 0) return;

      const sockets = await this.namespace.in(`user:${userId}`).fetchSockets();
      if (sockets.length === 0) return;

      const rows = await this.database.query<{ jti: string }>(
        `SELECT s.jti
         FROM user_sessions s
         JOIN users u ON u.user_id = s.user_id
         WHERE s.user_id = $1
           AND s.revoked_at IS NULL
           AND u.is_active = TRUE
           AND u.is_deleted = FALSE`,
        [userId],
      );
      const activeJtis = new Set(rows.map((row) => row.jti));

      for (const socket of sockets) {
        const identity = socket.data.identity as { jti?: string } | undefined;
        if (identity?.jti && activeJtis.has(identity.jti)) continue;
        // A legacy token without jti remains subject to the active-user check
        // in the handshake. Current tokens always have a jti.
        if (!identity?.jti && rows.length > 0) continue;
        socket.emit('realtime:session-revoked', {
          occurredAt: new Date().toISOString(),
        });
        socket.disconnect(true);
      }
    } catch {
      // A failed best-effort disconnect must not surface after COMMIT. HTTP
      // guards still reject the revoked session on its next API request.
    }
  }

  private emitToRooms(rooms: readonly RealtimeRoom[], payload: RealtimeUpdate) {
    if (!this.namespace) return;
    const uniqueRooms = [...new Set(rooms)];
    if (uniqueRooms.length === 0) return;

    let operator = this.namespace.to(uniqueRooms[0]);
    for (const room of uniqueRooms.slice(1)) operator = operator.to(room);
    operator.emit('realtime:update', payload);
  }
}
