<script setup >
import axios from 'axios'
import {reactive, ref, onMounted, toRefs} from "vue";
import {ElMessage, ElMessageBox} from 'element-plus'
import { Delete, Plus, Picture } from '@element-plus/icons-vue'
const houses = reactive([])
const isSubmitting = ref(false)

// 添加图片相关状态
const fileList = ref([])
const editFileList = ref([])
const imageUrls = ref({}) // 存储每个房源的图片URL
const handlePreview = () => {
  // 空实现，不做任何处理
}
// 修改获取房源方法
const getHouses = async () => {
  try {
    const res = await axios.get("http://localhost:5000/houses")
    console.log('获取房源数据:', res.data)  // 调试

    const validatedData = res.data.results.map(item => ({
      ...item,
      images: item.images || ''
    }))

    houses.splice(0, houses.length, ...validatedData)

    // 为每个房屋获取图片
    await Promise.all(houses.map(house => getHouseImages(house.id)))
  } catch (error) {
    console.error('获取房源失败:', error)
    ElMessage.error('获取房源数据失败')
  }
}

onMounted(() => {
  getHouses()
})

// 修改图片上传方法
const handleUpload = async (houseId) => {
  const formData = new FormData()
  fileList.value.forEach(file => {
    formData.append('file', file.raw)
  })

  try {
    await axios.post(`http://localhost:5000/houses/${houseId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
    return true
  } catch (error) {
    console.error('图片上传失败:', error)
    throw new Error('图片上传失败: ' + (error.response?.data?.message || error.message))
  }
}

// 合并提交方法
const handleSubmitWithImages = async (formEl) => {
  if (!formEl) return
  isSubmitting.value = true

  try {
    // 1. 先提交表单数据
    await submitEditForm(formEl)

    // 2. 如果有新图片，上传图片
    if (editFileList.value.length > 0) {
      try {
        await handleEditUpload()
        ElMessage.success('图片上传成功')
      } catch (uploadError) {
        console.error('图片上传失败:', uploadError)
        ElMessage.warning('表单提交成功，但图片上传失败')
      }
    }

    // 3. 刷新数据
    await getHouses()
  } catch (error) {
    console.error('提交失败:', error)
    ElMessage.error(`提交失败: ${error.response?.data?.message || error.message}`)
  } finally {
    isSubmitting.value = false
  }
}
// 修改原有的handleEditUpload方法
const handleEditUpload = async () => {
  if (!house_form.value.id || editFileList.value.length === 0) return

  const formData = new FormData()
  editFileList.value.forEach(file => {
    formData.append('file', file.raw)
  })

  await axios.post(`http://localhost:5000/houses/${house_form.value.id}/images`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })

  // 上传成功后清空列表
  editFileList.value = []
  // 刷新图片
  await getHouseImages(house_form.value.id)
}


// 修改删除图片方法
const handleDeleteImage = async (houseId, imageId) => {
  try {
    await axios.delete(`http://localhost:5000/houses/${houseId}/images/${imageId}`)
    ElMessage.success('图片删除成功')

    // 强制更新图片列表
    if (imageUrls.value[houseId]) {
      imageUrls.value[houseId] = imageUrls.value[houseId].filter(img => img.id !== imageId)

      // 如果是最后一张图片，设置为空数组
      if (imageUrls.value[houseId].length === 0) {
        imageUrls.value[houseId] = []
      }

      // 强制触发响应式更新
      imageUrls.value = {...imageUrls.value}
    }
  } catch (error) {
    console.error('删除失败:', error)
    ElMessage.error('图片删除失败')
  }
}

// 修改获取房屋图片方法
const getHouseImages = async (houseId) => {
  try {
    const res = await axios.get(`http://localhost:5000/houses/${houseId}/images`)
    if (res.data.images) {
      // 使用Vue.set确保响应式更新
      imageUrls.value = {
        ...imageUrls.value,
        [houseId]: res.data.images
      }
    } else {
      imageUrls.value = {
        ...imageUrls.value,
        [houseId]: []
      }
    }
  } catch (error) {
    console.error('获取图片失败:', error)
    imageUrls.value = {
      ...imageUrls.value,
      [houseId]: []
    }
  }
}

// 删除房源
const handleDelete = (index, scope) => {
  ElMessageBox.confirm('确定要删除这条房源信息吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    axios.delete(`http://localhost:5000/houses/${scope.id}`).then(() => {
      getHouses()
    })
  }).catch(() => {})
}


// 添加房源
const add_dialog_visible = ref(false)
const ruleFormRef = ref()

const formState = reactive({
  house_form: {
    id: "",
    title: "",
    address: "",
    house_type: "",
    area: "",
    rent: 0,
    deposit: 0,
    decor: "",
    status: "vacant",
    facility: "",
    model: "",
    description: "",
    publish_time: ""
  }
})
const { house_form } = toRefs(formState)

// 修改提交表单方法
const submitForm = async (formEl) => {
  if (!formEl) return
  isSubmitting.value = true

  try {
    const formData = {
      ...house_form.value,
      rent: parseFloat(house_form.value.rent),
      deposit: parseFloat(house_form.value.deposit)
    }

    // 1. 提交房源信息
    const response = await axios.post('http://localhost:5000/houses', formData)
    console.log('创建房源响应:', response.data) // 调试

    // 检查响应结构
    if (!response.data?.result?.id) {
      // 尝试从不同路径获取ID
      const newHouseId = response.data.id || response.data.result?.id || response.data.data?.id
      if (!newHouseId) {
        throw new Error('后端未返回有效的房源ID')
      }
      console.warn('非常规响应结构，获取到的ID:', newHouseId)
    }

    const newHouseId = response.data.result.id

    // 2. 上传图片
    if (fileList.value.length > 0) {
      try {
        await handleUpload(newHouseId)
      } catch (uploadError) {
        console.error('图片上传失败:', uploadError)
        ElMessage.warning('房源创建成功，但图片上传失败')
      }
    }

    // 3. 关闭对话框并刷新
    add_dialog_visible.value = false
    await getHouses()

    // 4. 重置表单
    resetAddForm(formEl)
    ElMessage.success('房源添加成功')

  } catch (error) {
    console.error('提交错误详情:', error)
    console.error('错误响应数据:', error.response?.data)

    const errorMsg = error.response?.data?.message ||
        error.message ||
        '创建房源失败，请检查网络或联系管理员'
    ElMessage.error(`提交失败: ${errorMsg}`)

    // 如果是ID问题但房源可能已创建，仍然关闭对话框
    if (error.message.includes('房源ID')) {
      add_dialog_visible.value = false
      await getHouses()
    }
  } finally {
    isSubmitting.value = false
  }
}


const submitEditForm = async (formEl) => {
  if (!formEl) return;

  try {
    // 确保数值类型正确
    const formData = {
      ...house_form.value,
      rent: parseFloat(house_form.value.rent) || 0,
      deposit: parseFloat(house_form.value.deposit) || 0
    };

    console.log("提交的编辑数据:", formData); // 调试用

    const response = await axios.put(
        `http://localhost:5000/houses/${house_form.value.id}`,
        formData,
        {
          headers: {
            "Content-Type": "application/json", // 必须设置
          },
        }
    );

    console.log("后端响应:", response.data); // 调试用

    edit_dialog_visible.value = false;
    getHouses(); // 刷新列表
    ElMessage.success("更新成功");
  } catch (error) {
    console.error("编辑提交错误:", error);
    ElMessage.error(`更新失败: ${error.response?.data?.message || error.message}`);
  }
};


// 编辑房源
const editFormRef = ref()
const edit_dialog_visible = ref(false)


// 修改 handleAddClick 方法
const handleAddClick = () => {
  // 生成新的空表单数据
  Object.assign(house_form.value, {
    id: "",
    title: "",
    address: "",
    house_type: "",
    area: "",
    rent: 0,
    deposit: 0,
    decor: "",
    status: "vacant",
    facility: "",
    model: "",
    description: "",
    publish_time: ""
  })

  // 重置上传文件列表
  fileList.value = []
  add_dialog_visible.value = true
}

// 修改 resetAddForm 方法
const resetAddForm = (formEl) => {
  if (!formEl) return
  formEl.resetFields()
  Object.assign(house_form.value, {
    id: "",
    title: "",
    address: "",
    house_type: "",
    area: "",
    rent: 0,
    deposit: 0,
    decor: "",
    status: "vacant",
    facility: "",
    model: "",
    description: "",
    publish_time: ""
  })

  // 重置上传文件列表
  fileList.value = []
}
// 编辑表单重置
const resetEditForm = (formEl) => {
  if (!formEl) return
  // 获取当前编辑的房源ID
  const currentId = house_form.value.id
  // 重新获取该房源的最新数据
  axios.get(`http://localhost:5000/houses/${currentId}`).then(res => {
    const houseData = res.data.result
    // 更新表单数据
    Object.assign(house_form.value, {
      ...houseData,
      rent: parseFloat(houseData.rent) || 0,
      deposit: parseFloat(houseData.deposit) || 0
    })
  })
}

// 编辑房源时加载图片
const handleEdit = (index, row) => {
  house_form.value = JSON.parse(JSON.stringify({
    ...row,
    rent: parseFloat(row.rent) || 0,
    deposit: parseFloat(row.deposit) || 0
  }))
  edit_dialog_visible.value = true
  getHouseImages(row.id)
}

// 状态选项
const statusOptions = [
  { value: 'vacant', label: '空置' },
  { value: 'rented', label: '已出租' },
  { value: 'maintenance', label: '维修中' }
]
// 状态选项
const modelOptions = [
  { value: 'yes', label: '支持' },
  { value: 'no', label: '不支持' }

]

</script>

<template>

  <div style="margin: 0 auto; width: 90%">
    <h1 style="text-align: center">智能房屋租赁系统</h1>

    <!-- 添加房源按钮 -->
    <el-button type="primary" @click="handleAddClick" size="small">添加房源</el-button>

    <!-- 房源表格 -->
    <el-table :data="houses" style="margin: 20px auto;" border>
      <el-table-column label="标题" prop="title" width="150"/>
      <el-table-column label="地址" prop="address" width="200"/>
      <el-table-column label="户型" prop="house_type" width="100"/>
      <el-table-column label="面积(㎡)" prop="area" width="100"/>
      <el-table-column label="租金(元)" prop="rent" width="100"/>
      <el-table-column label="押金(元)" prop="deposit" width="100"/>
      <el-table-column label="装修" prop="decor" width="100"/>
      <el-table-column label="设施" prop="facility" width="150"/>
      <el-table-column label="图片" width="120">
        <template #default="scope">
          <div v-if="imageUrls[scope.row.id] && imageUrls[scope.row.id].length">
            <el-image
                style="width: 100px; height: 70px"
                :src="'http://localhost:5000' + imageUrls[scope.row.id][0].url"
                fit="cover"
                :preview-src-list="imageUrls[scope.row.id].map(img => 'http://localhost:5000' + img.url)"
            >
              <template #error>
                <div class="image-slot">
                  <el-icon><Picture /></el-icon>
                </div>
              </template>
            </el-image>
          </div>
          <div v-else>
            暂无图片
          </div>
        </template>
      </el-table-column>
      <el-table-column label="是否支持3D" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.model === 'yes' ? 'success' : 'danger'">{{ scope.row.model === 'yes' ? '支持' :'不支持' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="scope">
          <el-tag :type="scope.row.status === 'vacant' ? 'success' : scope.row.status === 'rented' ? 'warning' : 'danger'">{{ scope.row.status === 'vacant' ? '空置' : scope.row.status === 'rented' ? '已出租' : '维修中' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column align="right" label="操作">
        <template #default="scope">
          <el-button size="small" @click="handleEdit(scope.$index, scope.row)">编辑</el-button>
          <el-button size="small" type="danger" @click="handleDelete(scope.$index, scope.row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <!-- 添加房源对话框 -->
  <el-dialog title="添加房源" v-model="add_dialog_visible" width="50%">
    <el-form ref="ruleFormRef" :model="house_form" label-width="100px">
      <el-form-item label="标题" prop="title">
        <el-input v-model="house_form.title" placeholder="请输入房源标题"/>
      </el-form-item>
      <el-form-item label="地址" prop="address">
        <el-input v-model="house_form.address" placeholder="请输入详细地址"/>
      </el-form-item>
      <el-form-item label="户型" prop="house_type">
        <el-input v-model="house_form.house_type" placeholder="如：2室1厅"/>
      </el-form-item>
      <el-form-item label="面积(㎡)" prop="area">
        <el-input v-model="house_form.area" placeholder="请输入面积"/>
      </el-form-item>
      <el-form-item label="租金(元)" prop="rent">
        <el-input-number v-model="house_form.rent" :min="0" :step="100"/>
      </el-form-item>
      <el-form-item label="押金(元)" prop="deposit">
        <el-input-number v-model="house_form.deposit" :min="0" :step="100"/>
      </el-form-item>
      <el-form-item label="装修情况" prop="decor">
        <el-input v-model="house_form.decor" placeholder="如：精装修、简装等"/>
      </el-form-item>
      <el-form-item label="设施" prop="facility">
        <el-input v-model="house_form.facility" placeholder="如：空调,冰箱,洗衣机等"/>
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input v-model="house_form.description" type="textarea" placeholder="请输入房源描述"/>
      </el-form-item>

      <el-form-item label="是否支持3D" prop="model">
        <el-select v-model="house_form.model" placeholder="请选择是否支持3D">
          <el-option
              v-for="item in modelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="house_form.status" placeholder="请选择状态">
          <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="上传图片">

        <el-upload
            v-model:file-list="fileList"
            action="#"
            list-type="picture-card"
            :auto-upload="false"
            :key="add_dialog_visible"
            :on-preview="handlePreview"
            multiple
        >
          <el-icon><Plus /></el-icon>
        </el-upload>
        <el-button
            type="primary"
            @click="submitForm(ruleFormRef).then(() => {
          if (fileList.length) {
            const newHouseId = houses[houses.length - 1]?.id;
            if (newHouseId) handleUpload(newHouseId);
          }
        })"
        >
          提交
        </el-button>

        <el-button @click="resetAddForm(ruleFormRef)">重置</el-button>
      </el-form-item>

    </el-form>
  </el-dialog>

  <!-- 编辑房源对话框 -->
  <el-dialog title="编辑房源" v-model="edit_dialog_visible" width="50%">
    <el-form ref="editFormRef" :model="house_form" label-width="100px">
      <el-form-item label="标题" prop="title">
        <el-input v-model="house_form.title"/>
      </el-form-item>
      <el-form-item label="地址" prop="address">
        <el-input v-model="house_form.address"/>
      </el-form-item>
      <el-form-item label="户型" prop="house_type">
        <el-input v-model="house_form.house_type"/>
      </el-form-item>
      <el-form-item label="面积(㎡)" prop="area">
        <el-input v-model="house_form.area"/>
      </el-form-item>
      <el-form-item label="租金(元)" prop="rent">
        <el-input-number v-model="house_form.rent" :min="0" :step="100"/>
      </el-form-item>
      <el-form-item label="押金(元)" prop="deposit">
        <el-input-number v-model="house_form.deposit" :min="0" :step="100"/>
      </el-form-item>
      <el-form-item label="装修情况" prop="decor">
        <el-input v-model="house_form.decor"/>
      </el-form-item>
      <el-form-item label="设施" prop="facility">
        <el-input v-model="house_form.facility" placeholder="如：空调,冰箱,洗衣机等"/>
      </el-form-item>
      <el-form-item label="描述" prop="description">
        <el-input v-model="house_form.description" type="textarea"/>
      </el-form-item>
      <el-form-item label="是否支持3D" prop="model">
        <el-select v-model="house_form.model">
          <el-option
              v-for="item in modelOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="house_form.status">
          <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          />
        </el-select>
      </el-form-item>
      <!-- 修改编辑对话框中的图片显示部分 -->
      <el-form-item label="现有图片">
        <div v-if="imageUrls[house_form.id] && imageUrls[house_form.id].length" class="image-container">
          <div v-for="img in imageUrls[house_form.id]" :key="img.id" class="image-item">
            <el-image
                style="width: 100px; height: 100px"
                :src="'http://localhost:5000' + img.url"
                fit="cover"
            ></el-image>
            <el-button
                type="danger"
                :icon="Delete"
                circle
                @click="handleDeleteImage(house_form.id, img.id)"
            ></el-button>
          </div>
        </div>
        <div v-else class="no-images">
          <el-icon><Picture /></el-icon>
          <span>暂无图片</span>
        </div>
      </el-form-item>

      <el-form-item label="上传新图片">
        <el-upload
            v-model:file-list="editFileList"
            action="#"
            list-type="picture-card"
            :auto-upload="false"
            multiple
        >
          <el-icon><Plus /></el-icon>
        </el-upload>

      </el-form-item>

      <el-form-item>

        <el-button
            type="primary"
            @click="handleSubmitWithImages(editFormRef)"
            :loading="isSubmitting"
        >
          {{ isSubmitting ? '提交中...' : '提交' }}
        </el-button>
        <el-button @click="resetEditForm(editFormRef)">重置</el-button>
      </el-form-item>
    </el-form>
  </el-dialog>
</template>

<style scoped>
.image-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.image-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.image-item .el-button {
  position: absolute;
  bottom: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
}
.no-images {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--el-text-color-secondary);
}

.image-container {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 50px; /* 防止删除最后一张时高度突变 */
}

</style>
