import jsPDF from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export interface SermonData {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

export const exportToPDF = async (sermon: SermonData) => {
  try {
    let sermonContent;
    try {
      sermonContent = JSON.parse(sermon.content);
    } catch {
      sermonContent = { sermao: sermon.content };
    }

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    
    let yPosition = margin;

    // Title
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    const titleLines = pdf.splitTextToSize(sermon.title, maxWidth);
    pdf.text(titleLines, margin, yPosition);
    yPosition += titleLines.length * 8 + 10;

    // Date
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const date = new Date(sermon.createdAt).toLocaleDateString('pt-BR');
    pdf.text(`Data: ${date}`, margin, yPosition);
    yPosition += 15;

    // Content
    pdf.setFontSize(12);
    const content = typeof sermonContent.sermao === 'string' 
      ? sermonContent.sermao 
      : sermon.content;
    
    // Split content into lines that fit the page width
    const lines = pdf.splitTextToSize(content, maxWidth);
    
    for (let i = 0; i < lines.length; i++) {
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(lines[i], margin, yPosition);
      yPosition += 6;
    }

    // Suggestions if available
    if (sermonContent.sugestoes_enriquecimento && Array.isArray(sermonContent.sugestoes_enriquecimento)) {
      yPosition += 10;
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Sugestões de Enriquecimento:", margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      sermonContent.sugestoes_enriquecimento.forEach((suggestion: string, index: number) => {
        if (yPosition > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
        }
        const suggestionLines = pdf.splitTextToSize(`${index + 1}. ${suggestion}`, maxWidth);
        pdf.text(suggestionLines, margin, yPosition);
        yPosition += suggestionLines.length * 6 + 5;
      });
    }

    // Quality assessment if available
    if (sermonContent.avaliacao_qualidade) {
      yPosition += 10;
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("Avaliação de Qualidade:", margin, yPosition);
      yPosition += 10;
      
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      const assessment = typeof sermonContent.avaliacao_qualidade === 'object' 
        ? `Nota: ${sermonContent.avaliacao_qualidade.nota}/10\n${sermonContent.avaliacao_qualidade.justificativa}`
        : sermonContent.avaliacao_qualidade;
      
      const assessmentLines = pdf.splitTextToSize(assessment, maxWidth);
      pdf.text(assessmentLines, margin, yPosition);
    }

    // Save the PDF
    const fileName = `${sermon.title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    pdf.save(fileName);
    
    return true;
  } catch (error) {
    console.error('Erro ao exportar PDF:', error);
    throw new Error('Falha ao gerar PDF');
  }
};

export const exportToDOCX = async (sermon: SermonData) => {
  try {
    let sermonContent;
    try {
      sermonContent = JSON.parse(sermon.content);
    } catch {
      sermonContent = { sermao: sermon.content };
    }

    const content = typeof sermonContent.sermao === 'string' 
      ? sermonContent.sermao 
      : sermon.content;

    const children = [
      // Title
      new Paragraph({
        children: [
          new TextRun({
            text: sermon.title,
            bold: true,
            size: 28,
          }),
        ],
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
      }),
      
      // Date
      new Paragraph({
        children: [
          new TextRun({
            text: `Data: ${new Date(sermon.createdAt).toLocaleDateString('pt-BR')}`,
            size: 20,
            italics: true,
          }),
        ],
        alignment: AlignmentType.RIGHT,
      }),
      
      // Empty line
      new Paragraph({ children: [new TextRun({ text: "" })] }),
      
      // Content
      ...content.split('\n').map((line: string) => 
        new Paragraph({
          children: [
            new TextRun({
              text: line,
              size: 24,
            }),
          ],
        })
      ),
    ];

    // Add suggestions if available
    if (sermonContent.sugestoes_enriquecimento && Array.isArray(sermonContent.sugestoes_enriquecimento)) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: "" })] }), // Empty line
        new Paragraph({
          children: [
            new TextRun({
              text: "Sugestões de Enriquecimento:",
              bold: true,
              size: 26,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
        })
      );
      
      sermonContent.sugestoes_enriquecimento.forEach((suggestion: string, index: number) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${index + 1}. ${suggestion}`,
                size: 22,
              }),
            ],
          })
        );
      });
    }

    // Add quality assessment if available
    if (sermonContent.avaliacao_qualidade) {
      children.push(
        new Paragraph({ children: [new TextRun({ text: "" })] }), // Empty line
        new Paragraph({
          children: [
            new TextRun({
              text: "Avaliação de Qualidade:",
              bold: true,
              size: 26,
            }),
          ],
          heading: HeadingLevel.HEADING_2,
        })
      );
      
      const assessment = typeof sermonContent.avaliacao_qualidade === 'object' 
        ? `Nota: ${sermonContent.avaliacao_qualidade.nota}/10\n${sermonContent.avaliacao_qualidade.justificativa}`
        : sermonContent.avaliacao_qualidade;
      
      assessment.split('\n').forEach((line: string) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                size: 22,
              }),
            ],
          })
        );
      });
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children,
        },
      ],
    });

    // Generate and save the document
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sermon.title.replace(/[^a-zA-Z0-9]/g, '_')}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return true;
  } catch (error) {
    console.error('Erro ao exportar DOCX:', error);
    throw new Error('Falha ao gerar DOCX');
  }
};