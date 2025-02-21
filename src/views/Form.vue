<!--
 * @Version    : v1.00
 * @Author     : itchaox
 * @Date       : 2023-09-26 15:10
 * @LastAuthor : Wang Chao
 * @LastTime   : 2025-02-21 16:14
 * @desc       : Markdown 预览插件
-->
<script setup>
  import { onMounted, watch, ref, watchEffect } from 'vue';
  import { bitable } from '@lark-base-open/js-sdk';

  import opencc from 'node-opencc';
  import { ElMessage, ElButton } from 'element-plus';
  import MarkdownIt from 'markdown-it';

  // 目标格式 s 简体; t 繁体
  const target = ref('t');

  // 选择模式 cell 单元格; field 字段; database 数据表
  const selectModel = ref('cell');

  const databaseList = ref();
  const databaseId = ref();
  const viewList = ref();
  const viewId = ref();
  const fieldList = ref();
  const fieldId = ref();

  const isLoading = ref(false);

  const base = bitable.base;

  // 当前点击字段id
  const currentFieldId = ref();
  const recordId = ref();

  const currentValue = ref();
  const currentRecordIndex = ref(0);
  const recordIds = ref([]);

  // 繁体模式 1 正体繁体; 2 台湾繁体; 3 香港繁体
  const traditionalModel = ref('1');

  // 地域模式 1 不使用; 2 台湾模式
  const localModel = ref('1');

  onMounted(async () => {
    databaseList.value = await base.getTableMetaList();
    await updateRecordIds();
  });

  async function updateRecordIds() {
    const table = await base.getActiveTable();
    if (!table) return;

    // 获取当前视图的记录 ID 列表
    const selection = await base.getSelection();
    const view = await table.getViewById(selection.viewId);
    const records = await view.getVisibleRecordIdList();
    recordIds.value = records;
  }

  async function switchRecord(direction) {
    if (!currentFieldId.value || recordIds.value.length === 0) return;

    const currentIndex = recordIds.value.findIndex((id) => id === recordId.value);
    if (currentIndex === -1) return;

    let newIndex;
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : recordIds.value.length - 1;
    } else {
      newIndex = currentIndex < recordIds.value.length - 1 ? currentIndex + 1 : 0;
    }

    recordId.value = recordIds.value[newIndex];
    currentRecordIndex.value = newIndex;

    const table = await base.getActiveTable();
    const data = await table.getCellValue(currentFieldId.value, recordId.value);
    if (data && data[0]) {
      currentValue.value = data[0].text;
      parsedContent.value = md.render(data[0].text || '');
    }
  }

  // 切换数据表, 默认选择第一个视图
  async function databaseChange() {
    if (selectModel.value === 'field') {
      const table = await base.getTable(databaseId.value);
      viewList.value = await table.getViewMetaList();
      viewId.value = viewList.value[0]?.id;
    }
  }

  // 根据视图列表获取字段列表
  watch(viewId, async (newValue, oldValue) => {
    const table = await base.getTable(databaseId.value);
    const view = await table.getViewById(newValue);
    const _list = await view.getFieldMetaList();

    // 只展示文本相关字段
    fieldList.value = _list.filter((item) => item.type === 1);
  });

  // 切换选择模式时,重置选择
  watch(selectModel, async (newValue, oldValue) => {
    if (newValue === 'cell') return;
    // 单列和数据表模式，默认选中当前数据表和当前视图

    const selection = await base.getSelection();
    databaseId.value = selection.tableId;

    if (newValue === 'field') {
      fieldId.value = '';
      fieldList.value = [];
      viewId.value = '';

      const table = await base.getTable(databaseId.value);
      viewList.value = await table.getViewMetaList();
      viewId.value = selection.viewId;
    }
  });

  // 数据表修改后，自动获取视图列表
  watchEffect(async () => {
    const table = await base.getTable(databaseId.value);
    viewList.value = await table.getViewMetaList();
  });

  // 初始化 markdown-it
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
    quotes: '""',
    headerIds: true,
    headerPrefix: 'md-header-',
    listIndent: 2,
    // 启用有序列表的连续编号
    ordered: true,
  });

  // 解析后的 HTML 内容
  const parsedContent = ref('');

  const currentFieldName = ref('');

  base.onSelectionChange(async (event) => {
    // 获取点击的字段id和记录id
    currentFieldId.value = event.data.fieldId;
    recordId.value = event.data.recordId;

    // 获取当前数据表和视图
    databaseId.value = event.data.tableId;
    viewId.value = event.data.viewId;

    const table = await base.getActiveTable();
    if (currentFieldId.value && recordId.value) {
      try {
        // 获取字段名称
        const field = await table.getFieldById(currentFieldId.value);
        const fieldMeta = await field.getMeta();
        currentFieldName.value = fieldMeta.name || '未知字段';

        // 修改当前数据
        let data = await table.getCellValue(currentFieldId.value, recordId.value);
        if (data && data[0] && data[0].text !== currentValue.value) {
          currentValue.value = data[0].text;
          // 解析 Markdown 内容
          parsedContent.value = md.render(data[0].text || '');
        }

        // 更新当前行号
        const currentIndex = recordIds.value.findIndex((id) => id === recordId.value);
        if (currentIndex !== -1) {
          currentRecordIndex.value = currentIndex;
        }
      } catch (error) {
        console.error('获取字段信息失败:', error);
        currentFieldName.value = '未知字段';
        currentValue.value = '';
        parsedContent.value = '';
      }
    } else {
      currentFieldName.value = '';
      currentValue.value = '';
      parsedContent.value = '';
    }

    // 更新记录ID列表
    await updateRecordIds();
  });

  async function confirm() {
    isLoading.value = true;
    if (selectModel.value === 'cell') {
      if (currentFieldId.value && recordId.value) {
        await cellModel();
      } else {
        ElMessage({
          type: 'error',
          message: '请选择需要转换的单元格!',
          duration: 1500,
          showClose: true,
        });
      }
    } else if (selectModel.value === 'field') {
      if (fieldId.value) {
        await fieldModel();
      } else {
        ElMessage({
          type: 'error',
          message: '请选择需要转换的字段!',
          duration: 1500,
          showClose: true,
        });
      }
    } else {
      await databaseModel();
    }
    isLoading.value = false;
  }

  async function cellModel() {
    ElMessage({
      message: '开始转换数据~',
      type: 'success',
      duration: 1500,
    });

    const table = await base.getActiveTable();
    let newValue = getNewValue(currentValue.value);

    if (currentFieldId.value && recordId.value) {
      await table.setCellValue(currentFieldId.value, recordId.value, newValue);
    }

    ElMessage({
      message: '数据转换结束!',
      type: 'success',
      duration: 1500,
    });
  }

  async function fieldModel() {
    ElMessage({
      message: '开始转换数据~',
      type: 'success',
      duration: 1500,
    });

    const table = await bitable.base.getTable(databaseId.value);

    await getAllRecordList();
    await getAllRecordIdList();

    let _list = [];

    for (let index = 0; index < recordList.length; index++) {
      const field = await table.getFieldById(fieldId.value);
      const cell = await field.getCell(recordIds.value[index]);
      const val = await cell.getValue();

      if (!val) continue;

      let newValue = getNewValue(val[0]?.text);

      // FIXME 处理数据
      _list.push({
        recordId: recordIds.value[index],
        fields: {
          [fieldId.value]: newValue,
        },
      });
    }

    // FIXME 此处一次性全部替换
    await table.setRecords(_list);

    ElMessage({
      message: '数据转换结束!',
      type: 'success',
      duration: 1500,
    });
  }

  async function getAllRecordIdList(_pageToken = 0) {
    const table = await bitable.base.getTable(databaseId.value);
    const data = await table.getRecordIdListByPage({ pageSize: 200, pageToken: _pageToken }); // 获取所有记录 id
    const { total, hasMore, recordIds: recordIdsData, pageToken } = data;
    recordIds.value.push(...recordIdsData);
    if (hasMore) {
      await getAllRecordIdList(pageToken);
    }
  }

  const recordList = [];
  async function getAllRecordList(_pageToken = 0) {
    const table = await bitable.base.getTable(databaseId.value);
    const data = await table.getRecordListByPage({ pageSize: 200, pageToken: _pageToken });
    const { total, hasMore, records: recordsData, pageToken } = data;
    recordList.push(...recordsData);

    if (hasMore) {
      await getAllRecordList(pageToken);
    }
  }

  async function databaseModel() {
    ElMessage({
      message: '开始转换数据~',
      type: 'success',
      duration: 1500,
    });

    const table = await bitable.base.getTable(databaseId.value);
    const _fieldList = await table.getFieldMetaList();

    await getAllRecordList();
    await getAllRecordIdList();

    const filterFieldList = _fieldList.filter((item) => item.type === 1);

    for (const item of filterFieldList) {
      let _list = [];
      for (let index = 0; index < recordList.length; index++) {
        // 只遍历文本列
        const field = await table.getFieldById(item.id);
        const cell = await field.getCell(recordIds[index]);
        const val = await cell.getValue();

        if (val) {
          let newValue = getNewValue(val[0]?.text);

          // FIXME 处理数据
          _list.push({
            recordId: recordIds[index],
            fields: {
              [item.id]: newValue,
            },
          });
        }
      }

      // FIXME 此处一次性全部替换
      await table.setRecords(_list);
    }

    ElMessage({
      message: '数据转换结束!',
      type: 'success',
      duration: 1500,
    });
  }

  function getNewValue(value) {
    let newValue;
    if (target.value === 's') {
      // 简体
      newValue = opencc.taiwanToSimplifiedWithPhrases(value);
    } else {
      // 繁体

      switch (traditionalModel.value) {
        case '1':
          // 正体繁体
          newValue = opencc.simplifiedToTraditional(value);
          break;
        case '2':
          // 台湾繁体
          if (localModel.value === '1') {
            newValue = opencc.simplifiedToTaiwan(value);
          } else {
            // 台湾地域
            newValue = opencc.simplifiedToTaiwanWithPhrases(value);
          }
          break;
        default:
          // 香港繁体
          newValue = opencc.simplifiedToHongKong(value);
      }
    }

    return newValue;
  }
</script>

<template>
  <div class="markdown-preview">
    <div
      class="header-container"
      v-if="currentValue"
    >
      <div class="header-content">
        <div class="cell-info">
          <span
            >当前字段：<strong>{{ currentFieldName }}</strong></span
          >
          <span
            >当前行号：<strong>{{ currentRecordIndex + 1 }}</strong></span
          >
        </div>
        <div class="navigation-buttons">
          <el-button
            @click="switchRecord('prev')"
            :disabled="!currentValue"
          >
            <span class="material-icons">上一个</span>
          </el-button>
          <el-button
            type="primary"
            @click="switchRecord('next')"
            :disabled="!currentValue"
          >
            <span class="material-icons">下一个</span>
          </el-button>
        </div>
      </div>
    </div>
    <div
      class="cell-preview"
      v-if="currentValue"
    >
      <div
        class="preview-content"
        v-html="parsedContent"
      ></div>
    </div>
    <div
      v-else
      class="empty-state"
    >
      <div class="empty-message">请选择一个单元格以预览 Markdown 内容</div>
    </div>
  </div>
</template>

<style scoped>
  .markdown-preview {
    font-weight: 400;
    padding: 4px;
    height: 96vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .cell-info {
    display: flex;
    justify-content: space-between;
    padding: 8px;
    background-color: #f5f7fa;
    border-radius: 4px;
    margin-bottom: 8px;
    font-size: 14px;
    color: #1f2329;
    font-weight: 600;
  }

  .navigation-buttons {
    margin: 6px 0;
  }

  .cell-preview {
    border: 1px solid #e5e6eb;
    border-radius: 4px;
    padding: 12px;
    margin-top: 6px;
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .empty-state {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 0;
  }

  .preview-content {
    line-height: 1.6;
    color: #1f2329;
  }

  .preview-content :deep(h1),
  .preview-content :deep(h2),
  .preview-content :deep(h3),
  .preview-content :deep(h4),
  .preview-content :deep(h5),
  .preview-content :deep(h6) {
    margin: 0.4em 0 0.4em;
    line-height: 1.4;
    font-weight: 600;
  }

  .preview-content :deep(h1) {
    font-size: 2em;
    margin-top: 0.6em;
  }

  .preview-content :deep(h2) {
    font-size: 1.5em;
  }

  .preview-content :deep(h3) {
    font-size: 1.25em;
  }

  .preview-content :deep(h4) {
    font-size: 1.1em;
  }

  .preview-content :deep(h5) {
    font-size: 1em;
  }

  .preview-content :deep(h6) {
    font-size: 0.9em;
  }

  .preview-content :deep(ul),
  .preview-content :deep(ol) {
    padding-left: 1.2em;
    margin: 0.6em 0;
    list-style-position: outside;
  }

  .preview-content :deep(ul) {
    list-style-type: disc;
  }

  .preview-content :deep(ol) {
    list-style-type: decimal;
  }

  .preview-content :deep(li) {
    margin: 0.5em 0;
    line-height: 1.6;
  }

  .preview-content :deep(strong),
  .preview-content :deep(b) {
    font-weight: 600;
  }

  .preview-content :deep(em),
  .preview-content :deep(i) {
    font-style: italic;
  }

  .preview-content :deep(code) {
    font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
    background-color: #f5f7fa;
    padding: 0.2em 0.4em;
    border-radius: 3px;
    font-size: 0.9em;
    color: #476582;
  }

  .preview-content :deep(pre) {
    background-color: #f5f7fa;
    padding: 1em;
    border-radius: 5px;
    overflow-x: auto;
    line-height: 1.5;
  }

  .preview-content :deep(pre code) {
    background-color: transparent;
    padding: 0;
    border-radius: 0;
    color: inherit;
  }

  .preview-content :deep(blockquote) {
    border-left: 4px solid #e5e6eb;
    margin: 1em 0;
    padding: 0.5em 0 0.5em 1em;
    color: #666;
    background-color: #f9f9f9;
  }

  .preview-content :deep(p) {
    margin: 0.6em 0;
    line-height: 1.6;
  }
</style>

<style>
  .selectStyle {
    .el-select-dropdown__item {
      font-weight: 300 !important;
    }

    .el-select-dropdown__item.selected {
      color: rgb(20, 86, 240);
    }
  }
</style>
