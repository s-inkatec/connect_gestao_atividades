import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const tasks=sqliteTable('tasks',{id:text('id').primaryKey(),payload:text('payload').notNull(),version:integer('version').notNull().default(1),updatedAt:text('updated_at').notNull()});
export const events=sqliteTable('events',{id:integer('id').primaryKey({autoIncrement:true}),taskId:text('task_id').notNull().references(()=>tasks.id),actor:text('actor').notNull(),message:text('message').notNull(),createdAt:text('created_at').notNull()},t=>[index('idx_events_task').on(t.taskId)]);
