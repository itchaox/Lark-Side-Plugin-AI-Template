<!--
 * @Version    : v1.00
 * @Author     : itchaox
 * @Date       : 2023-09-26 15:10
 * @LastAuthor : Wang Chao
 * @LastTime   : 2024-09-09 13:16
 * @desc       : 
-->
<script setup>
  import { onMounted, watch, ref, watchEffect } from 'vue';
  import { bitable } from '@lark-base-open/js-sdk';

  import opencc from 'node-opencc';
  import { ElMessage } from 'element-plus';

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

  // 繁体模式 1 正体繁体; 2 台湾繁体; 3 香港繁体
  const traditionalModel = ref('1');

  // 地域模式 1 不使用; 2 台湾模式
  const localModel = ref('1');

  onMounted(async () => {
    databaseList.value = await base.getTableMetaList();
  });

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

  base.onSelectionChange(async (event) => {
    // 获取点击的字段id和记录id
    currentFieldId.value = event.data.fieldId;
    recordId.value = event.data.recordId;

    // 获取当前数据表和视图
    databaseId.value = event.data.tableId;
    viewId.value = event.data.viewId;

    // FIXME 数据表切换后，视图自动切换

    const table = await base.getActiveTable();
    if (currentFieldId.value && recordId.value) {
      // 修改当前数据
      let data = await table.getCellValue(currentFieldId.value, recordId.value);
      if (data && data[0].text !== currentValue.value) {
        currentValue.value = data[0].text;
      }
    }
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
      const cell = await field.getCell(recordIds[index]);
      const val = await cell.getValue();

      if (!val) continue;

      let newValue = getNewValue(val[0]?.text);

      // FIXME 处理数据
      _list.push({
        recordId: recordIds[index],
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

  const recordIds = [];

  async function getAllRecordIdList(_pageToken = 0) {
    const table = await bitable.base.getTable(databaseId.value);
    const data = await table.getRecordIdListByPage({ pageSize: 200, pageToken: _pageToken }); // 获取所有记录 id
    const { total, hasMore, recordIds: recordIdsData, pageToken } = data;
    recordIds.push(...recordIdsData);
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
  <div class="s2t">
    <div>
      <div class="tip">
        <div class="tip-text title">操作步骤:</div>

        <div class="tip-text">1. 选择目标格式</div>
        <div class="tip-text">2. 目标格式为繁体, 自行选择繁体标准和地域模式</div>
        <div
          class="tip-text"
          v-if="selectModel === 'cell'"
        >
          3. 选择需要转换的单元格
        </div>
        <div
          class="tip-text"
          v-else-if="selectModel === 'field'"
        >
          3. 选择顺序: 数据表 -> 视图 -> 字段
        </div>
        <div
          class="tip-text"
          v-else-if="selectModel === 'database'"
        >
          3. 选择需要转换的数据表
        </div>
        <div class="tip-text">4. 点击【确认转换】按钮即可</div>
      </div>
    </div>

    <div class="label">
      <div class="text">目标格式:</div>
      <el-radio-group v-model="target">
        <el-radio-button label="s">简体</el-radio-button>
        <el-radio-button label="t">繁体</el-radio-button>
      </el-radio-group>
    </div>

    <div
      class="label"
      v-if="target === 't'"
    >
      <div class="text">繁体标准:</div>
      <el-radio-group v-model="traditionalModel">
        <el-radio-button label="1">正体繁体</el-radio-button>
        <el-radio-button label="2">台湾繁体</el-radio-button>
        <el-radio-button label="3">香港繁体</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 台湾繁体才允许选择地域, 其他都默认不使用 -->
    <div
      class="label"
      v-if="target === 't' && traditionalModel === '2'"
    >
      <div class="text">地域模式:</div>
      <el-radio-group v-model="localModel">
        <el-radio-button label="1">不使用</el-radio-button>
        <el-radio-button label="2">台湾模式</el-radio-button>
      </el-radio-group>
    </div>

    <div class="label">
      <div class="text">选择模式:</div>
      <el-radio-group v-model="selectModel">
        <el-radio-button label="cell">单元格</el-radio-button>
        <el-radio-button label="field">字段</el-radio-button>
        <el-radio-button label="database">数据表</el-radio-button>
      </el-radio-group>
    </div>

    <div
      class="label"
      v-if="selectModel !== 'cell'"
    >
      <div class="text">数据表:</div>
      <el-select
        v-model="databaseId"
        placeholder="请选择数据表"
        @change="databaseChange"
        popper-class="selectStyle"
      >
        <el-option
          v-for="item in databaseList"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
    </div>

    <div
      class="label"
      v-if="selectModel === 'field'"
    >
      <div class="text">视图:</div>
      <el-select
        v-model="viewId"
        placeholder="请选择视图"
        popper-class="selectStyle"
      >
        <el-option
          v-for="item in viewList"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
    </div>
    <div
      class="label"
      v-if="selectModel === 'field'"
    >
      <div class="text">字段:</div>
      <el-select
        v-model="fieldId"
        placeholder="请选择字段"
        popper-class="selectStyle"
      >
        <el-option
          v-for="item in fieldList"
          :key="item.id"
          :label="item.name"
          :value="item.id"
        />
      </el-select>
    </div>
    <el-button
      type="primary"
      class="btn"
      @click="confirm"
      :loading="isLoading"
    >
      确认转换</el-button
    >
  </div>
</template>

<style scoped>
  .s2t {
    font-family: LarkHackSafariFont, LarkEmojiFont, LarkChineseQuote, -apple-system, BlinkMacSystemFont, Helvetica Neue,
      Tahoma, PingFang SC, Microsoft Yahei, Arial, Hiragino Sans GB, sans-serif, Apple Color Emoji, Segoe UI Emoji,
      Segoe UI Symbol, Noto Color Emoji;
    font-weight: 300;
  }

  .tip {
    color: #8f959e;
    font-size: 12px;
    margin-bottom: 24px;
    .tip-text {
      margin-bottom: 4px;
    }

    .title {
      font-size: 14px;
      margin-bottom: 8px;
    }
  }

  .label {
    display: flex;
    align-items: center;
    margin-bottom: 20px;

    .text {
      width: 70px;
      margin-right: 10px;
      white-space: nowrap;
      font-size: 14px;
    }

    :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
      color: #fff;
      background-color: rgb(20, 86, 240);
      border-color: rgb(20, 86, 240);
      box-shadow: 1px 0 0 0 rgb(20, 86, 240);
    }

    :deep(.el-radio-button__inner) {
      font-weight: 300;
    }

    :deep(.el-radio-button__inner:hover) {
      color: rgb(20, 86, 240);
    }

    :deep(.el-input__inner) {
      font-weight: 300;
    }
  }

  .btn {
    margin-top: 14px;
    background-color: rgb(20, 86, 240);
    border-color: rgb(20, 86, 240);
    font-weight: 300;
    &:hover {
      background-color: rgb(51, 109, 244);
      border-color: rgb(20, 86, 240);
    }
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
