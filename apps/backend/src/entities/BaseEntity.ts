import { PrimaryKey, Property } from '@mikro-orm/core';

/**
 * 모든 엔티티의 기본이 되는 추상 클래스
 * id, createdAt, updatedAt 필드를 공통으로 관리
 */
export abstract class BaseEntity {
  @PrimaryKey()
  id!: number;

  @Property()
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
} 