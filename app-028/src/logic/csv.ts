/**
 * 导出 CSV：
 *  - 带 UTF-8 BOM，Excel / WPS 直接双击打开中文不乱码
 *  - RFC 4180 转义：单元格含逗号 / 引号 / 换行时整体加引号、内部引号双写，列不串位
 *  - 行尾 \r\n（RFC 4180），各表格软件都能正确分行
 */
import { round } from './units'
import type { Paper, Placement, Sheet, Task } from './types'

/** UTF-8 BOM：表格软件据此按 UTF-8 解码 */
export const CSV_BOM = '\uFEFF'

/** RFC 4180 单元格转义 */
export function csvCell(cell: string | number): string {
  const s = String(cell ?? '')
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n')
}

export function csvBlob(rows: Array<Array<string | number>>): Blob {
  return new Blob([CSV_BOM + toCsv(rows)], { type: 'text/csv;charset=utf-8' })
}

/** 与「裁切步骤」预览一致的 0.1mm 舍入：预览与导出文件是同一套数 */
const r1 = (n: number): number => round(n, 1)

/**
 * 切割清单 CSV 的行数据。
 * 每一刀都从传入的 sheets（当前生效的排样结果，与裁切步骤预览同一份对象）逐刀展开，
 * 改摆位 / 换纸后重新导出即跟着变；坐标、起止、长度均按 0.1mm 舍入，与预览显示一致。
 */
export function cutListRows(
  task: Task,
  paper: Paper,
  sheets: Sheet[],
  sizeLabelOf: (p: Placement) => string,
): Array<Array<string | number>> {
  const rows: Array<Array<string | number>> = [
    ['任务', task.name],
    ['相纸', `${paper.name} ${paper.wMm}x${paper.hMm}mm`],
    ['隙距 mm', task.gapMm],
    ['刀宽补偿 mm', task.kerfMm],
    ['安全边 mm', task.safeEdgeMm],
    ['相纸张数', sheets.length],
    ['照片总数', sheets.reduce((acc, s) => acc + s.placements.length, 0)],
    [],
    ['切割清单（逐刀）'],
    [
      '说明',
      '竖切：坐标为 x，起点/终点为 y 区间；横切：坐标为 y，起点/终点为 x 区间。单位 mm，原点在相纸左上角；与「裁切步骤」预览同一份数据，均保留 0.1mm。',
    ],
    ['相纸序号', '刀序', '方向', '坐标 mm', '起点 mm', '终点 mm', '长度 mm', '是否共边合并'],
  ]
  for (const s of sheets) {
    s.cutSteps.forEach((c, i) => {
      rows.push([
        s.index + 1,
        i + 1,
        c.axis === 'v' ? '竖切' : '横切',
        r1(c.at),
        r1(c.from),
        r1(c.to),
        r1(c.to - c.from),
        c.merged ? '是' : '否',
      ])
    })
  }
  rows.push([])
  rows.push(['照片对号表'])
  rows.push(['照片编号', '所在相纸', 'X mm', 'Y mm', '宽 mm', '高 mm', '旋转', '尺寸'])
  for (const s of sheets) {
    for (const p of s.placements) {
      rows.push([
        p.seq,
        s.index + 1,
        r1(p.x),
        r1(p.y),
        r1(p.w),
        r1(p.h),
        p.rotated ? '90°' : '无',
        sizeLabelOf(p),
      ])
    }
  }
  return rows
}
