// Simple test script to verify API endpoints
const BASE_URL = 'http://localhost:3000/api';

async function testAPIs() {
  console.log('Testing English Mistake Review Tool APIs...\n');

  try {
    // Test Dashboard API
    console.log('1. Testing Dashboard API...');
    const dashboardResponse = await fetch(`${BASE_URL}/dashboard`);
    const dashboardData = await dashboardResponse.json();
    console.log('✓ Dashboard API working:', dashboardData);

    // Test adding a mistake
    console.log('\n2. Testing Add Mistake API...');
    const addResponse = await fetch(`${BASE_URL}/mistakes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error_sentence: 'I have went to the store yesterday.',
        correct_sentence: 'I went to the store yesterday.',
        explanation: 'Use simple past for specific completed actions in the past.'
      })
    });
    const addResult = await addResponse.json();
    console.log('✓ Add Mistake API working:', addResult);

    // Test getting mistakes
    console.log('\n3. Testing Get Mistakes API...');
    const getResponse = await fetch(`${BASE_URL}/mistakes`);
    const mistakes = await getResponse.json();
    console.log('✓ Get Mistakes API working, found', mistakes.length, 'mistakes');

    // Test batch add
    console.log('\n4. Testing Batch Add API...');
    const batchResponse = await fetch(`${BASE_URL}/mistakes/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        batchText: 'He don\'t like it | He doesn\'t like it | Use doesn\'t with third person singular\nShe have a book | She has a book | Use has with third person singular',
      })
    });
    const batchResult = await batchResponse.json();
    console.log('✓ Batch Add API working:', batchResult);

    // Test calendar API
    console.log('\n5. Testing Calendar API...');
    const calendarResponse = await fetch(`${BASE_URL}/calendar`);
    const calendarData = await calendarResponse.json();
    console.log('✓ Calendar API working, found', Object.keys(calendarData.reviewCounts).length, 'dates with reviews');

    console.log('\n✅ All API tests passed!');

  } catch (error) {
    console.error('❌ API test failed:', error);
  }
}

// Wait a moment for the server to be ready
setTimeout(() => {
  testAPIs();
}, 3000);
