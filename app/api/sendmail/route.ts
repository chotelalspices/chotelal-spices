import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    const senderName = process.env.BREVO_SENDER_NAME;

    if (!apiKey || !senderEmail || !senderName) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required environment variables' 
      }, { status: 500 });
    }

    // Get email data from request body
    const body = await request.json();
    const { to, subject, htmlContent } = body;

    if (!to || !subject || !htmlContent) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: to, subject, htmlContent' 
      }, { status: 400 });
    }

    const emailData = {
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: Array.isArray(to) ? to.map(email => ({ email })) : [{ email: to }],
      subject: subject,
      htmlContent: htmlContent
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(emailData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to send email');
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Email sent successfully',
      data: data
    });

  } catch (error: any) {
    console.error('Error sending email:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Failed to send email' 
    }, { status: 500 });
  }
}
