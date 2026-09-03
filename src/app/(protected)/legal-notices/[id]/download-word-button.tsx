'use client'

import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'

export function DownloadWordButton({
  title,
  content,
}: {
  title: string
  content: string
}) {
  const handleDownload = () => {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
      </head>
      <body>`;
    
    // Replace newlines with <br> for HTML rendering
    const formattedContent = content.replace(/\n/g, '<br/>');
    
    const footer = "</body></html>";
    const sourceHTML = header + `<div style="font-family: Arial, sans-serif; font-size: 12pt;">${formattedContent}</div>` + footer;

    const blob = new Blob(['\ufeff', sourceHTML], {
      type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_notice.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDownload}>
      <FileText className="w-3.5 h-3.5 mr-1.5" />
      Download Word Doc
    </Button>
  )
}
