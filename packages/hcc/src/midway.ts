import { getRouter, getSource, loadApiFiles } from '@midwayjs/hooks-internal'
import { join, relative, removeExt } from 'upath'
import fs from 'fs'
import art from 'art-template'
import difference from 'lodash/difference'
import type { AbstractRouter } from '@midwayjs/hooks-core'

export enum GenerateTarget {
  JS,
  TS,
}

export async function hcc() {
  const source = getSource({ useSourceFile: false })
  const router = getRouter(source)
  let code = getEntryCode(source, router, GenerateTarget.JS)
  code += `module.exports = require('./configuration');`

  const entry = join(source, 'hcc.js')
  fs.writeFileSync(entry, code, 'utf8')

  return entry
}

export function getEntryCode(
  source: string,
  router: AbstractRouter,
  target: GenerateTarget,
  filter: (file: string) => boolean = () => true
) {
  const result = loadApiFiles({ source, router })

  const relativePath = (file: string) => relative(source, file)
  const files = difference(result.files, result.apis)
    .map(relativePath)
    .filter((file) => filter(file))
  const apis = result.apis.map(relativePath)

  return target === GenerateTarget.JS
    ? getJSCode(files, apis)
    : getTSCode(files, apis)
}

export function getJSCode(files: string[], apis: string[]) {
  const tpl = `
    // This file is auto-generated by @midwayjs/hcc, any modification will be overwritten.
    const { setHydrateOptions } = require('@midwayjs/hooks-internal');

    setHydrateOptions({
      modules: [
        {{each apis}}
          {
            file: '{{$value}}',
            mod: require('./{{$value}}'),
          },
        {{/each}}
      ]
    })

    {{each files}}require('./{{$value}}');\n{{/each}}
  `

  return art.render(tpl, {
    files,
    apis,
  })
}

export function getTSCode(files: string[], apis: string[]) {
  const tpl = `
    import { setHydrateOptions } from '@midwayjs/hooks-internal';

    setHydrateOptions({
      modules: [
        {{each apis}}
          {
            file: '/{{$value}}.ts',
            mod: require('./{{$value}}'),
          },
        {{/each}}
      ]
    });

    {{each files}}import './{{$value}}';\n{{/each}}
  `

  const code = art.render(tpl, {
    files: files.map((file) => removeExt(file, '.ts')),
    apis: apis.map((file) => removeExt(file, '.ts')),
  })
  return code.trim()
}
