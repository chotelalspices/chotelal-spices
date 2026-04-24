// Test script to verify the label case-insensitivity fix
// This can be run with: node scripts/test-label-fix.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCaseInsensitiveLabelCreation() {
  console.log('Testing case-insensitive label creation...\n');

  try {
    // Clean up any existing test labels
    await prisma.label.deleteMany({
      where: {
        name: {
          contains: 'test_label',
          mode: 'insensitive'
        }
      }
    });

    // Test 1: Create first label with uppercase
    console.log('1. Creating label "TEST_LABEL"...');
    const label1 = await prisma.label.create({
      data: {
        name: 'TEST_LABEL',
        minimumStock: 10,
        status: 'active',
        costPerUnit: 1.0
      }
    });
    console.log(`   Created: ${label1.name} (ID: ${label1.id})\n`);

    // Test 2: Try to create same label with different case - should fail
    console.log('2. Attempting to create duplicate label "test_label"...');
    try {
      const label2 = await prisma.label.create({
        data: {
          name: 'test_label',
          minimumStock: 5,
          status: 'active',
          costPerUnit: 2.0
        }
      });
      console.log(`   ERROR: Created duplicate: ${label2.name} (ID: ${label2.id})\n`);
    } catch (error) {
      console.log('   SUCCESS: Duplicate creation prevented\n');
    }

    // Test 3: Try to create same label with mixed case - should fail
    console.log('3. Attempting to create duplicate label "Test_Label"...');
    try {
      const label3 = await prisma.label.create({
        data: {
          name: 'Test_Label',
          minimumStock: 8,
          status: 'active',
          costPerUnit: 1.5
        }
      });
      console.log(`   ERROR: Created duplicate: ${label3.name} (ID: ${label3.id})\n`);
    } catch (error) {
      console.log('   SUCCESS: Duplicate creation prevented\n');
    }

    // Test 4: Verify case-insensitive lookup
    console.log('4. Testing case-insensitive lookup...');
    const foundLabel1 = await prisma.label.findFirst({
      where: {
        name: {
          equals: 'test_label',
          mode: 'insensitive'
        }
      }
    });
    const foundLabel2 = await prisma.label.findFirst({
      where: {
        name: {
          equals: 'TEST_LABEL',
          mode: 'insensitive'
        }
      }
    });
    const foundLabel3 = await prisma.label.findFirst({
      where: {
        name: {
          equals: 'Test_Label',
          mode: 'insensitive'
        }
      }
    });

    if (foundLabel1.id === foundLabel2.id && foundLabel2.id === foundLabel3.id) {
      console.log(`   SUCCESS: All lookups returned same label: ${foundLabel1.name}\n`);
    } else {
      console.log('   ERROR: Lookups returned different labels\n');
    }

    // Test 5: Test formulation product creation with existing label
    console.log('5. Testing formulation product creation...');
    
    // Create a test formulation first
    const formulation = await prisma.formulation.create({
      data: {
        name: 'Test Formulation',
        baseQuantity: 100,
        baseUnit: 'kg',
        defaultQuantity: 1,
        status: 'active'
      }
    });

    // Create product with existing label (different case)
    console.log('   Creating product with label "test_label" (different case)...');
    const product = await prisma.finishedProduct.create({
      data: {
        name: 'Test Product',
        quantity: 100,
        unit: 'kg',
        formulationId: formulation.id,
        productLabels: {
          create: [{
            quantity: 10,
            semiPackageable: false,
            label: {
              connect: { id: label1.id }
            }
          }]
        }
      },
      include: {
        productLabels: {
          include: { label: true }
        }
      }
    });

    console.log(`   SUCCESS: Product created with existing label: ${product.productLabels[0].label.name}\n`);

    // Cleanup
    await prisma.productLabel.deleteMany({
      where: { finishedProductId: product.id }
    });
    await prisma.finishedProduct.delete({ where: { id: product.id } });
    await prisma.formulation.delete({ where: { id: formulation.id } });
    await prisma.label.delete({ where: { id: label1.id } });

    console.log('All tests completed successfully!');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCaseInsensitiveLabelCreation();
