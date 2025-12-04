// 测试批量添加 API
const testBatchAPI = async () => {
  const testData = {
    batchText: "I have went to school | I have gone to school | 测试\nHe don't like it | He doesn't like it | 测试2"
  };

  console.log('📤 发送测试数据到 API...');
  console.log('数据:', testData);

  try {
    const response = await fetch('https://my-english-tool.vercel.app/api/mistakes/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData),
    });

    console.log('📊 响应状态:', response.status, response.statusText);
    
    const data = await response.json();
    console.log('📦 响应数据:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('❌ 请求失败');
      console.error('错误详情:', data);
    } else {
      console.log('✅ 请求成功！');
    }
  } catch (error) {
    console.error('❌ 网络错误:', error.message);
  }
};

testBatchAPI();
