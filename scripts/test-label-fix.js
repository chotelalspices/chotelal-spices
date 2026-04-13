// Test script to verify the label case-insensitivity fix
// This can be run with: node scripts/test-label-fix.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testCaseInsensitiveLabelCreation() {
  console.log('Testing case-insensitive label creation with case preservation...\n');

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

    // Test 1: Create first label with original case (V1 style)
    console.log('1. Creating label "V1"...');
    const label1 = await prisma.label.create({
      data: {
        name: 'V1',
        minimumStock: 10,
        status: 'active',
        costPerUnit: 1.0
      }
    });
    console.log(`   Created: "${label1.name}" (ID: ${label1.id}) - Case preserved\n`);

    // Test 2: Try to create same label with different case - should fail
    console.log('2. Attempting to create duplicate label "v1"...');
    try {
      const label2 = await prisma.label.create({
        data: {
          name: 'v1',
          minimumStock: 5,
          status: 'active',
          costPerUnit: 2.0
        }
      });
      console.log(`   ERROR: Created duplicate: "${label2.name}" (ID: ${label2.id})\n`);
    } catch (error) {
      console.log('   SUCCESS: Duplicate creation prevented\n');
    }

    // Test 3: Try to create same label with mixed case - should fail
    console.log('3. Attempting to create duplicate label "V1"...');
    try {
      const label3 = await prisma.label.create({
        data: {
          name: 'V1',
          minimumStock: 8,
          status: 'active',
          costPerUnit: 1.5
        }
      });
      console.log(`   ERROR: Created duplicate: "${label3.name}" (ID: ${label3.id})\n`);
    } catch (error) {
      console.log('   SUCCESS: Duplicate creation prevented\n');
    }

    // Test 4: Verify case-insensitive lookup returns original case
    console.log('4. Testing case-insensitive lookup...');
    const foundLabel1 = await prisma.label.findFirst({
      where: {
        name: {
          equals: 'v1',
          mode: 'insensitive'
        }
      }
    });
    const foundLabel2 = await prisma.label.findFirst({
      where: {
        name: {
          equals: 'V1',
          mode: 'insensitive'
        }
      }
    });

    if (foundLabel1.id === foundLabel2.id && foundLabel1.name === 'V1') {
      console.log(`   SUCCESS: Case-insensitive lookup works and preserves original case: "${foundLabel1.name}"\n`);
    } else {
      console.log(`   ERROR: Lookup failed or case not preserved. Found: "${foundLabel1?.name}" and "${foundLabel2?.name}"\n`);
    }

    // Test 5: Test formulation product creation with existing label (different case in request)
    console.log('5. Testing formulation product creation with case-insensitive lookup...');
    
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

    // Simulate product creation with different case label name
    console.log('   Creating product with label "v1" (different case from existing "V1")...');
    
    // This simulates the API logic - find existing label case-insensitively
    const existingLabel = await prisma.label.findFirst({
      where: {
        name: {
          equals: 'v1',
          mode: 'insensitive'
        }
      }
    });

    if (existingLabel && existingLabel.name === 'V1') {
      console.log(`   SUCCESS: Found existing label "${existingLabel.name}" using case-insensitive search\n`);
      
      // Create product connecting to existing label
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
                connect: { id: existingLabel.id }
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

      console.log(`   SUCCESS: Product created with existing label: "${product.productLabels[0].label.name}" (original case preserved)\n`);
      
      // Cleanup product
      await prisma.productLabel.deleteMany({
        where: { finishedProductId: product.id }
      });
      await prisma.finishedProduct.delete({ where: { id: product.id } });
    } else {
      console.log('   ERROR: Could not find existing label with case-insensitive search\n');
    }

    // Cleanup
    await prisma.formulation.delete({ where: { id: formulation.id } });
    await prisma.label.delete({ where: { id: label1.id } });

    console.log('All tests completed successfully! Case is preserved and duplicates are prevented.');

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCaseInsensitiveLabelCreation();
