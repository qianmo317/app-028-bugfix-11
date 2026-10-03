/** 导出 CSV：UTF-8 BOM + RFC 4180 转义，Excel/WPS/Numbers 可直接打开 */
import { round } from './units'
import type { Paper, Placement, Sheet, Task } from './types'

export type CsvCell = string | number | null | undefined
export type CsvRows = Array<CsvCell[]>

const UTF8_BOM = '\uFEFF'

function csvCell(value: CsvCell): string {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(rows: CsvRows): string {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const lines = rows.map((row) =>
    Array.from({ length: width }, (_, i) => csvCell(row[i])).join(','),
  )
  return UTF8_BOM + lines.join('\r\n')
}

export function csvBlob(rows: CsvRows): Blob {
  return new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
}

function mm(value: number): number {
  const n = round(value, 3)
  return Object.is(n, -0) ? 0 : n
}

function cutDirection(axis: Sheet['cutSteps'][number]['axis']): string {
  return axis === 'v' ? '竖切' : '横切'
}

function endpoints(cut: Sheet['cutSteps'][number]): [number, number, number, number, number] {
  if (cut.axis === 'v') {
    return [cut.at, cut.from, cut.at, cut.to, cut.to - cut.from]
  }
  return [cut.from, cut.at, cut.to, cut.at, cut.to - cut.from]
}

/**
 * 切割清单的所有刀口均直接取自当前 Sheet.cutSteps；这些 CutStep 由当前 placements、
 * 当前相纸和裁切参数实时重建，不读取上一次导出文件，也不缓存旧坐标。
 */
export function cutListRows(
  task: Task,
  paper: Paper,
  sheets: Sheet[],
  sizeLabelOf: (seq: number) => string,
): CsvRows {
  const rows: CsvRows = [
    ['任务名称', task.name],
    ['相纸', `${paper.name} ${paper.wMm}×${paper.hMm}mm`],
    ['隙距 mm', task.gapMm],
    ['刀宽补偿 mm', task.kerfMm],
    ['安全边 mm', task.safeEdgeMm],
    ['相纸张数', sheets.length],
    ['坐标原点', '相纸左上角；X 轴向右，Y 轴向下；长度单位均为 mm'],
    [
      '数据来源',
      task.manual
        ? '当前手工微调排样（已通过 guillotine 贯通校验）'
        : '当前自动排样结果',
    ],
    [
      '一致性说明',
      '屏幕预览、PDF/PNG 与本 CSV 取自同一份当前排样几何；修改摆位或换纸后应重新导出，旧文件与当前预览不一致时以当前预览为准',
    ],
    [],
    ['一、相纸汇总'],
    ['相纸序号', '相纸宽 mm', '相纸高 mm', '照片数', '切割刀数', '未合并切割刀数'],
  ]

  for (const sheet of sheets) {
    rows.push([
      sheet.index + 1,
      mm(paper.wMm),
      mm(paper.hMm),
      sheet.placements.length,
      sheet.cutSteps.length,
      sheet.rawCutCount,
    ])
  }

  rows.push(
    [],
    ['二、逐刀切割明细'],
    [
      '相纸序号',
      '刀序',
      '切割方向',
      '切割坐标 mm',
      '起点 X mm',
      '起点 Y mm',
      '终点 X mm',
      '终点 Y mm',
      '切口长度 mm',
      '是否共边合并',
    ],
  )

  for (const sheet of sheets) {
    sheet.cutSteps.forEach((cut, index) => {
      const [x1, y1, x2, y2, length] = endpoints(cut)
      rows.push([
        sheet.index + 1,
        index + 1,
        cutDirection(cut.axis),
        mm(cut.at),
        mm(x1),
        mm(y1),
        mm(x2),
        mm(y2),
        mm(length),
        cut.merged ? '是' : '否',
      ])
    })
  }

  rows.push(
    [],
    ['三、照片对号表'],
    [
      '照片编号',
      '所在相纸',
      '尺寸',
      'X mm',
      'Y mm',
      '版面宽 mm',
      '版面高 mm',
      '是否旋转',
    ],
  )

  for (const sheet of sheets) {
    for (const placement of sheet.placements as Placement[]) {
      rows.push([
        placement.seq,
        sheet.index + 1,
        sizeLabelOf(placement.seq),
        mm(placement.x),
        mm(placement.y),
        mm(placement.w),
        mm(placement.h),
        placement.rotated ? '90°' : '无',
      ])
    }
  }

  return rows
}
