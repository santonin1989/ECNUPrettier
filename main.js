// ==UserScript==
// @name         ECNUPrettier
// @namespace    http://santonin.top/
// @version      1.0
// @description  Make ECNU Website Great Again !
// @author       Santonin
// @match        https://applicationnewjw.ecnu.edu.cn/eams/home.action*
// @match        https://applicationnewjw.ecnu.edu.cn/eams/myPlanCompl.action*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @license      GPL-3.0-or-later; https://www.gnu.org/licenses/gpl-3.0.txt
// ==/UserScript==

let tableData = [];

/** 重新累加计算每个非叶子节点的 leafNum */
function accLeafNum(result) {
  function computeLeafNum(node) {
    if (!node.children) return;
    if (node.isLeaf) {
      if (!node.isFold) node.leafNum = node.children.length;
      else node.leafNum = 1;
      return;
    }
    node.leafNum = 0;
    for (const child of node.children) {
      computeLeafNum(child);
      node.leafNum += child.leafNum || 1;
    }
  }

  for (const node of result) {
    computeLeafNum(node);
  }
  return result;
}

/** 表格数据整型 */
function foldItems(items) {
  const result = [];
  let lastKind1 = null;
  let lastKind2 = null;

  // 第一步：构建树结构
  for (const item of items) {
    if (item.kind === 1) {
      result.push(item);
      lastKind1 = item;
      lastKind2 = null;
    } else if (item.kind === 2) {
      if (lastKind1) {
        lastKind1.children.push(item);
        lastKind2 = item;
      }
    } else if (item.kind === 3) {
      if (lastKind2) {
        lastKind2.children.push(item);
      }
    }
  }

  // 第二步：补全空 children（加一个 null 子节点）
  function ensureNonEmptyChildren(node) {
    if (!node.children) return;
    if (node.children.length === 0) {
      node.children = [{ isFake: true }];
      node.isLeaf = true;
      node.isFold = false;
    } else {
      if (node.children[0].kind === undefined) {
        node.isLeaf = true;
        node.isFold = false;
      } else {
        node.isLeaf = false;
      }
      for (const child of node.children) {
        if (child) ensureNonEmptyChildren(child);
      }
    }
  }

  for (const node of result) {
    ensureNonEmptyChildren(node);
  }

  // 第三步：自底向上累加 leafNum
  return accLeafNum(result);
}

/** 表格渲染函数 */
function renderTable(data) {
  const $table = $('<table>').css({
    width: '100%',
    borderCollapse: 'collapse',
    margin: '10px 0px',
    border: '1px solid #ccc',
    lineHeight: '20px',
    fontSize: '14px',
  });

  const thStyle = { border: '1px solid #ccc', padding: '4px 8px' };
  const tdStyle = { border: '1px solid #ccc', padding: '4px 8px' };

  const $thead = $('<thead>').append(
    $('<tr>')
      .css({ backgroundColor: '#F6F6F6' })
      .append(
        $('<th>').text('1').css(thStyle).css({ width: '11%' }),
        $('<th>').text('2').css(thStyle).css({ width: '9%' }),
        $('<th>').text('3').css(thStyle).css({ width: '22%' }),
        $('<th>').text('代码').css(thStyle).css({ width: '13%' }),
        $('<th>').text('名称').css(thStyle).css({ width: '24%' }),
        $('<th>').text('学分').css(thStyle).css({ width: '4%' }),
        $('<th>').text('成绩').css(thStyle).css({ width: '5%' }),
        $('<th>').text('通过否').css(thStyle).css({ width: '6%' }),
        $('<th>').text('备注').css(thStyle).css({ width: '6%' })
      )
  );

  const $tbody = $('<tbody>');

  function renderCreditUI({ finishedCredit, credit }) {
    const colors = [
      ['#E3FCD1', '#55CB00'],
      ['#D1EFFC', '#0C92CD'],
      ['#FEE6E3', '#F1604D'],
    ];
    const colorFlag = finishedCredit - credit >= 0 ? 0 : 2;
    return $('<div>')
      .css({
        borderRadius: '999px',
        background: colors[colorFlag][0],
        color: colors[colorFlag][1],
        fontWeight: 600,
        padding: '2px 8px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      })
      .append(
        $('<p>')
          .css({ margin: 0, fontSize: '12px', whiteSpace: 'nowrap' })
          .text(`${finishedCredit} / ${credit}`)
      );
  }

  function renderKind(data) {
    const content = $('<div>')
      .css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      })
      .append($('<p>').css({ margin: 0 }).text(data.name))
      .append(renderCreditUI(data));
    return $('<div>')
      .css({
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      })
      .append(content);
  }

  function renderSideHeader(data) {
    const content = $('<div>')
      .css({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '8px',
      })
      .append($('<p>').css({ margin: 0 }).text(data.name))
      .append(renderCreditUI(data));

    const res = $('<div>');
    res.css({
      width: '100%',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    });

    const btn = $('<button>');
    btn.text(data.isFold ? '展开' : '收纳');
    btn.css({
      border: 'none',
      cursor: 'pointer',
      height: '24px',
    });
    btn.click(() => {
      data.isFold = !data.isFold;
      rerender();
    });
    return res.append(content).append(btn);
  }

  function renderFirstKind(kind, isLeaf = false) {
    if (isLeaf)
      return $('<td>')
        .html(renderSideHeader(kind))
        .css(tdStyle)
        .attr('rowspan', kind.leafNum);
    else
      return $('<td>')
        .html(renderKind(kind))
        .css(tdStyle)
        .attr('rowspan', kind.leafNum);
  }

  function renderFakeChild(row, child) {
    const isFake = Boolean(child.children[0].isFake);
    $tbody.append(
      row.append(
        $('<td>')
          .html(`${isFake ? 0 : child.children.length} 门课程`)
          .css({ ...tdStyle, textAlign: 'center' })
          .attr('colspan', 6)
      )
    );
  }

  function renderTd(row, item) {
    const {
      courseSequence,
      courseCode,
      courseName,
      credit,
      finishedCredit,
      score,
      isPass,
      remark,
    } = item;

    $tbody.append(
      row.append(
        $('<td>')
          .css(tdStyle)
          .html(courseCode ?? ''),
        $('<td>')
          .css({
            ...tdStyle,
            color: isPass === '是' ? '' : 'red',
          })
          .html(courseName ?? ''),
        $('<td>')
          .css(tdStyle)
          .html(credit ?? ''),
        $('<td>')
          .css(tdStyle)
          .html(score ?? ''),
        $('<td>')
          .css(tdStyle)
          .html(isPass ?? ''),
        $('<td>')
          .css(tdStyle)
          .html(remark ?? '')
      )
    );
  }

  function addRows(items, $tbody) {
    items.forEach((kind1, index1) => {
      kind1.children.forEach((kind2, index2) => {
        if (kind2.children.length && kind2.children[0].kind === 3) {
          // 有 kind3
          kind2.children.forEach((kind3, index3) => {
            if (kind3.isFold) {
              let row = $('<tr>');
              if (index2 === 0) {
                row.append(renderFirstKind(kind1));
              }
              if (index3 === 0) {
                row.append(renderFirstKind(kind2));
              }
              row.append(renderFirstKind(kind3, true));

              // const isFake = Boolean(kind3.children[0].isFake);
              // $tbody.append(
              //   row.append(
              //     $('<td>')
              //       .html(`${isFake ? 0 : kind3.children.length}门课程`)
              //       .css(tdStyle)
              //       .attr('colspan', 6)
              //   )
              // );
              renderFakeChild(row, kind3);
            } else
              kind3.children.forEach((item, index4) => {
                let row = $('<tr>');
                if (index4 === 0) {
                  if (index2 === 0) {
                    row.append(renderFirstKind(kind1));
                  }
                  if (index3 === 0) {
                    row.append(renderFirstKind(kind2));
                  }
                  row.append(renderFirstKind(kind3, true));
                }
                renderTd(row, item);
              });
          });
        } else {
          // 没有 kind3
          if (kind2.isFold) {
            let row = $('<tr>');
            if (index2 === 0) {
              // 如果这是渲染 kind1 的第一行，需要额外渲染左侧表头
              row.append(renderFirstKind(kind1));
            }
            // 如果这是渲染 kind2 的第一行，需要额外渲染左侧表头
            row.append(renderFirstKind(kind2, true).attr('colspan', 2));

            // const isFake = Boolean(kind2.children[0].isFake);
            // $tbody.append(
            //   row.append(
            //     $('<td>')
            //       .html(`${isFake ? 0 : kind2.children.length}门课程`)
            //       .css(tdStyle)
            //       .attr('colspan', 6)
            //   )
            // );
            renderFakeChild(row, kind2);
          } else
            kind2.children.forEach((item, index3) => {
              let row = $('<tr>');
              if (index3 === 0) {
                if (index2 === 0) {
                  row.append(renderFirstKind(kind1));
                }
                row.append(renderFirstKind(kind2, true).attr('colspan', 2));
              }
              renderTd(row, item);
            });
        }
      });
    });
  }

  addRows(data, $tbody);

  $table.append($thead).append($tbody);

  return $('<div>')
    .css({
      width: '100%',
      maxHeight: '100%',
      overflowY: 'auto',
    })
    .attr('id', 'pretty-table-container')
    .append($table);
}

let $modal = null;
let $closeBtn = null;
let $allUnfold = null;
let $allFold = null;
let $overlay = null;
/** 重渲染弹窗内的表格和关闭按钮 */
function rerender() {
  tableData = accLeafNum(tableData);
  console.log(tableData);

  const scrollTop = $('#pretty-table-container').scrollTop();
  if ($modal && $closeBtn) {
    $modal.empty();
    $modal
      .append($closeBtn.click(closeModal))
      .append($allUnfold.click(allUnfold))
      .append($allFold.click(allFold))
      .append(renderTable(tableData));
    $('#pretty-table-container').scrollTop(scrollTop);
  }
}

/** 关闭弹窗事件 */
function closeModal() {
  if ($overlay) {
    $overlay.remove();
    $('body > *:not(#custom-overlay)').css('filter', 'none');
  }
}

function goThroughLeaf(node, fn) {
  if (!node.children) return;
  if (node.isLeaf) {
    fn(node);
  } else {
    for (const child of node.children) {
      goThroughLeaf(child, fn);
    }
  }
}

/** 全部展开事件 */
function allUnfold() {
  for (const node of tableData) {
    goThroughLeaf(node, (node) => {
      node.isFold = false;
    });
  }
  rerender();
}
/** 全部收纳事件 */
function allFold() {
  for (const node of tableData) {
    goThroughLeaf(node, (node) => {
      node.isFold = true;
    });
  }
  rerender();
}

/** 展示表格弹窗 */
function showOverlayWithTable(tableData) {
  // 模糊背景
  $('body > *:not(#custom-overlay)').css('filter', 'blur(4px)');

  // 遮罩层
  $overlay = $('<div id="custom-overlay">').css({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    zIndex: 9999,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  });

  // 弹窗容器
  $modal = $('<div>').css({
    background: '#fff',
    padding: '40px 20px 20px',
    borderRadius: '8px',
    boxShadow: '0 0 10px rgba(0,0,0,0.3)',
    height: '90vh',
    width: '1200px',
    minWidth: '800px',
    position: 'relative',
  });

  // 关闭按钮
  $closeBtn = $('<button>关闭</button>');
  $closeBtn.css({
    position: 'absolute',
    top: '12px',
    right: '12px',
    cursor: 'pointer',
  });
  $closeBtn.click(closeModal);

  // 全部展开
  $allUnfold = $('<button>全部展开</button>');
  $allUnfold.css({
    position: 'absolute',
    top: '12px',
    left: '12px',
    cursor: 'pointer',
  });
  $allUnfold.click(allUnfold);

  // 全部收纳
  $allFold = $('<button>全部收纳</button>');
  $allFold.css({
    position: 'absolute',
    top: '12px',
    left: '96px',
    cursor: 'pointer',
  });
  $allFold.click(allFold);

  $modal
    .append($closeBtn)
    .append($allUnfold)
    .append($allFold)
    .append(renderTable(tableData));

  $overlay.append($modal);
  $('body').append($overlay);
}

const kindOne = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const kindTwo = [
  '(一)',
  '(二)',
  '(三)',
  '(四)',
  '(五)',
  '(六)',
  '(七)',
  '(八)',
  '(九)',
  '(十)',
];

function mainPrettier() {
  const $chartView = $('#chartView');
  if ($chartView) {
    $('#chartView table tbody tr').each(function () {
      // 读取表格行
      const rowData = [];
      $(this)
        .find('td')
        .each(function () {
          rowData.push($(this).text().trim());
        });
      // 整型数据
      if (rowData.length === 8) {
        // 是具体的课程条目
        if (tableData.length) {
          const last = tableData.at(-1);
          last.leafNum++;
          last.children.push({
            courseSequence: rowData[0],
            courseCode: rowData[1],
            courseName: rowData[2],
            credit: rowData[3],
            finishedCredit: rowData[4],
            score: rowData[5],
            isPass: rowData[6],
            remark: rowData[7],
          });
        }
      } else if (rowData.length === 6) {
        // 是课程所属门类
        let kind = 0;
        if (kindOne.some((prefix) => rowData[0].startsWith(prefix))) {
          kind = 1;
        } else if (kindTwo.some((prefix) => rowData[0].startsWith(prefix))) {
          kind = 2;
        } else {
          kind = 3;
        }

        if (kind !== 0) {
          tableData.push({
            kind: kind,
            leafNum: 0,
            name: rowData[0].replace('(所有子项均应满足要求)', ''),
            credit: rowData[1],
            finishedCredit: rowData[2],
            children: [],
          });
        }
      } else {
        console.error('未知的表格行！ Unknown table row !');
      }
    });

    tableData = foldItems(tableData);
    console.log(tableData);

    showOverlayWithTable(tableData);
    return true;
  } else {
    return false;
  }
}

(function () {
  ('use strict');

  $(document).ready(function () {
    console.log("I'm Santonin");
    const myBtn = $('<div>');
    myBtn.text('Prettified Table').css({
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      boxShadow: '4px 4px 12px rgba(0, 0, 0, 0.2)',
      borderRadius: '999px',
      height: '40px',
      padding: '0px 12px',
      backgroundColor: 'white',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      userSelect: 'none',
      cursor: 'pointer',
    });
    myBtn.click(() => {
      if (tableData.length) {
        showOverlayWithTable(tableData);
        return;
      }
      const res = mainPrettier();
      if (!res) {
        console.log('当前页面没有chartView');
      }
    });
    $('body').append(myBtn);
  });
})();
