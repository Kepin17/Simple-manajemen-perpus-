import 'reflect-metadata';
import { describe, expect, it } from 'bun:test';
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';
import pkg from '../package.json';

describe('AppController', () => {
  it('GET /health mengembalikan status ok', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    const controller = moduleRef.get(AppController);
    expect(controller.health()).toEqual({ status: 'ok' });
  });

  it('GET /version mengembalikan name dan version dari package.json', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    const controller = moduleRef.get(AppController);
    expect(controller.version()).toEqual({
      name: pkg.name,
      version: pkg.version,
    });
  });
});
