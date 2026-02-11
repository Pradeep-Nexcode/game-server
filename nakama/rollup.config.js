import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';

export default {
  input: 'data/modules/main.ts',
  output: {
    file: 'data/modules/build/main.js',
    format: 'iife',
    name: 'ServerModule',
    footer: [
      'globalThis.InitModule = function InitModule(ctx, logger, nk, initializer) { return ServerModule.InitModule(ctx, logger, nk, initializer); };',
      'globalThis.matchInit = function matchInit(ctx, logger, nk, params) { return ServerModule.matchInit(ctx, logger, nk, params); };',
      'globalThis.matchJoinAttempt = function matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata) { return ServerModule.matchJoinAttempt(ctx, logger, nk, dispatcher, tick, state, presence, metadata); };',
      'globalThis.matchJoin = function matchJoin(ctx, logger, nk, dispatcher, tick, state, presence) { return ServerModule.matchJoin(ctx, logger, nk, dispatcher, tick, state, presence); };',
      'globalThis.matchLeave = function matchLeave(ctx, logger, nk, dispatcher, tick, state, presences) { return ServerModule.matchLeave(ctx, logger, nk, dispatcher, tick, state, presences); };',
      'globalThis.matchLoop = function matchLoop(ctx, logger, nk, dispatcher, tick, state, messages) { return ServerModule.matchLoop(ctx, logger, nk, dispatcher, tick, state, messages); };',
      'globalThis.matchTerminate = function matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds) { return ServerModule.matchTerminate(ctx, logger, nk, dispatcher, tick, state, graceSeconds); };',
      'globalThis.matchSignal = function matchSignal(ctx, logger, nk, dispatcher, tick, state, data) { return ServerModule.matchSignal(ctx, logger, nk, dispatcher, tick, state, data); };',
      'globalThis.matchmakerMatched = function matchmakerMatched(ctx, logger, nk, matchedUsers) { return ServerModule.matchmakerMatched(ctx, logger, nk, matchedUsers); };',
    ].join('\n')
  },
  plugins: [
    resolve(),
    commonjs(),
    json(),
    typescript({
      compilerOptions: {
        target: 'es5',
        module: 'esnext',
        outDir: undefined,
        declaration: false,
        lib: ['es2015']
      }
    }),
  ],
};
